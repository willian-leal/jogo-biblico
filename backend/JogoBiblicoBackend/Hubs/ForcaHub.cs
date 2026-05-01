using JogoBiblicoBackend.Models;
using JogoBiblicoBackend.Services;
using Microsoft.AspNetCore.SignalR;

namespace JogoBiblicoBackend.Hubs;

public record CriarSalaRequest(string NomeEquipe, int Quantidade, string? Dificuldade, string? Testamento);

public class ForcaHub : Hub
{
    private readonly PerguntaService _perguntaService;
    private readonly SalaService _salaService;
    private readonly IHubContext<ForcaHub> _hubContext;

    public ForcaHub(PerguntaService perguntaService, SalaService salaService, IHubContext<ForcaHub> hubContext)
    {
        _perguntaService = perguntaService;
        _salaService = salaService;
        _hubContext = hubContext;
    }

    // ── CriarSala ─────────────────────────────────────────────────────────────
    public async Task CriarSala(CriarSalaRequest req)
    {
        var perguntas = _perguntaService.GetForca(req.Quantidade, req.Dificuldade, req.Testamento);
        if (perguntas.Count == 0)
        {
            await Clients.Caller.SendAsync("ErroSala", "Nenhuma pergunta encontrada com os filtros selecionados.");
            return;
        }

        var sala = new SalaForca
        {
            SessaoId = perguntas[0].SessaoId,
            Perguntas = perguntas,
            MascaraAtual = [.. perguntas[0].Mascara],
            Equipes = [new EquipeSala { Nome = req.NomeEquipe, Pontos = 0 }],
            Jogadores = [new JogadorConectado(Context.ConnectionId, req.NomeEquipe, EhAnfitriao: true)]
        };

        var codigo = _salaService.CriarSala(sala);
        await Groups.AddToGroupAsync(Context.ConnectionId, codigo);

        await Clients.Caller.SendAsync("SalaCriada", new
        {
            codigoSala = codigo,
            minhaEquipe = req.NomeEquipe,
            estadoSala = BuildEstadoSala(sala)
        });
    }

    // ── EntrarNaSala ──────────────────────────────────────────────────────────
    public async Task EntrarNaSala(string codigo, string nomeEquipe)
    {
        codigo = codigo.ToUpperInvariant().Trim();
        nomeEquipe = nomeEquipe.Trim();

        var sala = _salaService.ObterSala(codigo);
        if (sala is null)
        {
            await Clients.Caller.SendAsync("ErroSala", "Sala não encontrada.");
            return;
        }

        string? erroLock = null;
        lock (sala)
        {
            if (sala.Fase != FaseJogo.Aguardando)
                erroLock = "O jogo já começou.";
            else if (sala.Equipes.Any(e => e.Nome.Equals(nomeEquipe, StringComparison.OrdinalIgnoreCase)))
                erroLock = "Já existe uma equipe com esse nome nessa sala.";
            else
            {
                sala.Equipes.Add(new EquipeSala { Nome = nomeEquipe, Pontos = 0 });
                sala.Jogadores.Add(new JogadorConectado(Context.ConnectionId, nomeEquipe, EhAnfitriao: false));
            }
        }

        if (erroLock is not null)
        {
            await Clients.Caller.SendAsync("ErroSala", erroLock);
            return;
        }

        _salaService.RegistrarConexao(Context.ConnectionId, codigo);
        await Groups.AddToGroupAsync(Context.ConnectionId, codigo);

        await Clients.Caller.SendAsync("EntradaConfirmada", new
        {
            minhaEquipe = nomeEquipe,
            estadoSala = BuildEstadoSala(sala)
        });

        await Clients.OthersInGroup(codigo).SendAsync("JogadorEntrou", new
        {
            nomeEquipe,
            totalEquipes = sala.Equipes.Count
        });
    }

    // ── IniciarJogo ───────────────────────────────────────────────────────────
    public async Task IniciarJogo()
    {
        var (sala, erro) = GetSalaDoAnfitriao();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        string? erroLock = null;
        lock (sala!)
        {
            if (sala.Fase != FaseJogo.Aguardando)
                erroLock = "O jogo já foi iniciado.";
            else if (sala.Equipes.Count < 2)
                erroLock = "São necessárias pelo menos 2 equipes para iniciar.";
            else
            {
                sala.Fase = FaseJogo.Transicao;
                sala.IndicePerguntaAtual = 0;
                sala.IndiceEquipeAtual = 0;
                sala.MascaraAtual = [.. sala.PerguntaAtual.Mascara];
                sala.LetrasUsadas = [];
                sala.LetrasErradas = [];
            }
        }

        if (erroLock is not null) { await Clients.Caller.SendAsync("ErroSala", erroLock); return; }

        await Clients.Group(sala!.CodigoSala).SendAsync("ProximaRodada", BuildEstadoSala(sala));
    }

    // ── MarcarPronto ──────────────────────────────────────────────────────────
    public async Task MarcarPronto()
    {
        var (sala, erro) = GetSalaDoJogadorAtivo();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        string? erroLock = null;
        lock (sala!)
        {
            if (sala.Fase != FaseJogo.Transicao)
                erroLock = "Ação inválida nesta fase.";
            else
                sala.Fase = FaseJogo.Jogando;
        }

        if (erroLock is not null) { await Clients.Caller.SendAsync("ErroSala", erroLock); return; }

        await Clients.Group(sala!.CodigoSala).SendAsync("IniciarRodada", new
        {
            indicePergunta = sala.IndicePerguntaAtual,
            totalPerguntas = sala.Perguntas.Count,
            indiceEquipe = sala.IndiceEquipeAtual,
            nomeEquipe = sala.EquipeAtual.Nome
        });
    }

    // ── EscolherLetra ─────────────────────────────────────────────────────────
    public async Task EscolherLetra(string letra)
    {
        var (sala, erro) = GetSalaDoJogadorAtivo();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        string letraNorm = letra.ToUpperInvariant();
        string? erroLock = null;
        lock (sala!)
        {
            if (sala.Fase != FaseJogo.Jogando)
                erroLock = "Ação inválida nesta fase.";
            else if (sala.LetrasUsadas.Contains(letraNorm))
                erroLock = "Letra já utilizada.";
        }

        if (erroLock is not null) { await Clients.Caller.SendAsync("ErroSala", erroLock); return; }

        var resultado = _perguntaService.VerificarLetraForca(sala!.SessaoId, sala.IndicePerguntaAtual, letra);
        if (resultado is null) { await Clients.Caller.SendAsync("ErroSala", "Letra inválida."); return; }

        bool finalizada;
        int indiceEquipeAtual;
        string nomeEquipeAtual;
        int pontos = 0;
        object equipes;
        IReadOnlySet<string> letrasUsadas;
        IReadOnlySet<string> letrasErradas;

        lock (sala)
        {
            sala.LetrasUsadas.Add(letraNorm);
            sala.MascaraAtual = resultado.Mascara;

            if (resultado.Acertou)
            {
                sala.EquipeAtual.Pontos += 1;
                pontos = 1;
                if (resultado.Finalizada)
                {
                    sala.EquipeAtual.Pontos += 3;
                    pontos += 3;
                }
            }
            else
            {
                sala.LetrasErradas.Add(letraNorm);
                sala.IndiceEquipeAtual = (sala.IndiceEquipeAtual + 1) % sala.Equipes.Count;
            }

            finalizada = resultado.Finalizada;
            indiceEquipeAtual = sala.IndiceEquipeAtual;
            nomeEquipeAtual = sala.EquipeAtual.Nome;
            equipes = sala.Equipes.Select(e => new { e.Nome, e.Pontos }).ToList();
            letrasUsadas = sala.LetrasUsadas;
            letrasErradas = sala.LetrasErradas;
        }

        await Clients.Group(sala.CodigoSala).SendAsync("ResultadoLetra", new
        {
            letra = letraNorm,
            acertou = resultado.Acertou,
            mascara = resultado.Mascara,
            finalizada,
            respostaCorreta = resultado.RespostaCorreta,
            pontos,
            equipes,
            letrasUsadas,
            letrasErradas,
            indiceEquipeAtual,
            nomeEquipeAtual
        });

        if (finalizada)
            _ = AutoAvancarRodada(sala.CodigoSala, sala.IndicePerguntaAtual);
    }

    // ── AbrirChute ────────────────────────────────────────────────────────────
    public async Task AbrirChute()
    {
        var (sala, erro) = GetSalaDoJogadorAtivo();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        if (sala!.Fase != FaseJogo.Jogando) { await Clients.Caller.SendAsync("ErroSala", "Ação inválida nesta fase."); return; }

        await Clients.Group(sala.CodigoSala).SendAsync("ChuteAberto", new { nomeEquipe = sala.EquipeAtual.Nome });
    }

    // ── CancelarChute ─────────────────────────────────────────────────────────
    public async Task CancelarChute()
    {
        var (sala, erro) = GetSalaDoJogadorAtivo();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        await Clients.Group(sala!.CodigoSala).SendAsync("ChuteCancelado", new { });
    }

    // ── EnviarChute ───────────────────────────────────────────────────────────
    public async Task EnviarChute(string resposta)
    {
        var (sala, erro) = GetSalaDoJogadorAtivo();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        if (sala!.Fase != FaseJogo.Jogando) { await Clients.Caller.SendAsync("ErroSala", "Ação inválida nesta fase."); return; }

        var resultado = _perguntaService.ChutarForca(sala.SessaoId, sala.IndicePerguntaAtual, resposta);
        if (resultado is null) { await Clients.Caller.SendAsync("ErroSala", "Não foi possível validar o chute."); return; }

        int pontos = 0;
        int indiceEquipeAtual;
        string nomeEquipeAtual;
        object equipes;
        int indicePerguntaParaAvanco;

        lock (sala)
        {
            if (resultado.Correta)
            {
                pontos = sala.LetrasUsadas.Count == 0 ? 5 : 0;
                sala.EquipeAtual.Pontos += pontos;
            }
            else
            {
                sala.IndiceEquipeAtual = (sala.IndiceEquipeAtual + 1) % sala.Equipes.Count;
            }

            indiceEquipeAtual = sala.IndiceEquipeAtual;
            nomeEquipeAtual = sala.EquipeAtual.Nome;
            equipes = sala.Equipes.Select(e => new { e.Nome, e.Pontos }).ToList();
            indicePerguntaParaAvanco = sala.IndicePerguntaAtual;
        }

        await Clients.Group(sala.CodigoSala).SendAsync("ResultadoChute", new
        {
            correta = resultado.Correta,
            respostaCorreta = resultado.RespostaCorreta,
            pontos,
            equipes,
            indiceEquipeAtual,
            nomeEquipeAtual
        });

        if (resultado.Correta)
            _ = AutoAvancarRodada(sala.CodigoSala, indicePerguntaParaAvanco);
    }

    // ── EntrarComoEspectador ──────────────────────────────────────────────────
    public async Task EntrarComoEspectador(string codigo)
    {
        codigo = codigo.ToUpperInvariant().Trim();
        var sala = _salaService.ObterSala(codigo);
        if (sala is null)
        {
            await Clients.Caller.SendAsync("ErroSala", "Sala não encontrada.");
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, codigo);

        await Clients.Caller.SendAsync("EntradaEspectador", new
        {
            estadoSala = BuildEstadoSala(sala)
        });
    }

    // ── AvancarRodada (forçado pelo anfitrião) ────────────────────────────────
    public async Task AvancarRodada()
    {
        var (sala, erro) = GetSalaDoAnfitriao();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        await AvancarParaProximaRodada(sala!.CodigoSala, sala.IndicePerguntaAtual);
    }

    // ── OnDisconnectedAsync ───────────────────────────────────────────────────
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var sala = _salaService.SalaDoJogador(Context.ConnectionId);
        _salaService.RemoverConexao(Context.ConnectionId);

        if (sala is not null)
        {
            JogadorConectado? jogador = null;
            bool eraAnfitriao = false;
            bool jogoEncerrado = false;

            lock (sala)
            {
                jogador = sala.Jogadores.FirstOrDefault(j => j.ConnectionId == Context.ConnectionId);
                if (jogador is not null)
                {
                    eraAnfitriao = jogador.EhAnfitriao;
                    sala.Jogadores.Remove(jogador);
                    jogoEncerrado = sala.Jogadores.Count == 0 || eraAnfitriao;
                    if (jogoEncerrado) sala.Fase = FaseJogo.Encerrada;
                }
            }

            if (jogador is not null)
            {
                await Clients.Group(sala.CodigoSala).SendAsync("JogadorSaiu", new
                {
                    nomeEquipe = jogador.NomeEquipe,
                    eraAnfitriao,
                    jogoEncerrado
                });

                if (sala.Jogadores.Count == 0)
                    _salaService.RemoverSala(sala.CodigoSala);
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private (SalaForca? sala, string? erro) GetSalaDoJogador()
    {
        var sala = _salaService.SalaDoJogador(Context.ConnectionId);
        return sala is null ? (null, "Você não está em nenhuma sala.") : (sala, null);
    }

    private (SalaForca? sala, string? erro) GetSalaDoAnfitriao()
    {
        var (sala, erro) = GetSalaDoJogador();
        if (erro is not null) return (null, erro);

        var jogador = sala!.Jogadores.FirstOrDefault(j => j.ConnectionId == Context.ConnectionId);
        return jogador is null || !jogador.EhAnfitriao
            ? (null, "Somente o anfitrião pode executar esta ação.")
            : (sala, null);
    }

    private (SalaForca? sala, string? erro) GetSalaDoJogadorAtivo()
    {
        var (sala, erro) = GetSalaDoJogador();
        if (erro is not null) return (null, erro);

        var jogador = sala!.Jogadores.FirstOrDefault(j => j.ConnectionId == Context.ConnectionId);
        if (jogador is null) return (null, "Você não está nesta sala.");

        return jogador.NomeEquipe != sala.EquipeAtual.Nome
            ? (null, "Não é a vez da sua equipe.")
            : (sala, null);
    }

    private object BuildEstadoSala(SalaForca sala) => new
    {
        codigoSala = sala.CodigoSala,
        fase = sala.Fase.ToString().ToLowerInvariant(),
        equipes = sala.Equipes.Select(e => new { e.Nome, e.Pontos }).ToList(),
        indiceEquipeAtual = sala.IndiceEquipeAtual,
        nomeEquipeAtual = sala.Equipes.Count > 0 ? sala.EquipeAtual.Nome : "",
        indicePerguntaAtual = sala.IndicePerguntaAtual,
        totalPerguntas = sala.Perguntas.Count,
        perguntaAtual = sala.Perguntas.Count > 0 ? (object)new
        {
            id = sala.PerguntaAtual.Id,
            dica = sala.PerguntaAtual.Dica,
            mascara = sala.MascaraAtual,
            dificuldade = sala.PerguntaAtual.Dificuldade
        } : null,
        letrasUsadas = sala.LetrasUsadas.ToList(),
        letrasErradas = sala.LetrasErradas.ToList()
    };

    private async Task AutoAvancarRodada(string codigoSala, int indicePerguntaEsperado)
    {
        await Task.Delay(2500);
        await AvancarParaProximaRodada(codigoSala, indicePerguntaEsperado);
    }

    private async Task AvancarParaProximaRodada(string codigoSala, int indicePerguntaEsperado)
    {
        var sala = _salaService.ObterSala(codigoSala);
        if (sala is null) return;

        bool encerrada;
        lock (sala)
        {
            if (sala.IndicePerguntaAtual != indicePerguntaEsperado) return;
            if (sala.Fase == FaseJogo.Encerrada) return;

            if (sala.IndicePerguntaAtual < sala.Perguntas.Count - 1)
            {
                sala.IndicePerguntaAtual++;
                sala.IndiceEquipeAtual = (sala.IndiceEquipeAtual + 1) % sala.Equipes.Count;
                sala.MascaraAtual = [.. sala.PerguntaAtual.Mascara];
                sala.LetrasUsadas = [];
                sala.LetrasErradas = [];
                sala.Fase = FaseJogo.Transicao;
                encerrada = false;
            }
            else
            {
                sala.Fase = FaseJogo.Encerrada;
                encerrada = true;
            }
        }

        if (encerrada)
        {
            await _hubContext.Clients.Group(codigoSala).SendAsync("JogoEncerrado", new
            {
                ranking = sala.Equipes.OrderByDescending(e => e.Pontos)
                                      .Select(e => new { e.Nome, e.Pontos })
                                      .ToList()
            });
        }
        else
        {
            await _hubContext.Clients.Group(codigoSala).SendAsync("ProximaRodada", BuildEstadoSala(sala));
        }
    }
}
