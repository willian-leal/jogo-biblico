using JogoBiblicoBackend.Models;
using JogoBiblicoBackend.Services;
using Microsoft.AspNetCore.SignalR;

namespace JogoBiblicoBackend.Hubs;

public record CriarSalaEquipesRequest(string NomeEquipe, int Quantidade, string? Dificuldade, string? Testamento);

public class EquipesHub : Hub
{
    private readonly PerguntaService _perguntaService;
    private readonly SalaEquipesService _salaService;
    private readonly IHubContext<EquipesHub> _hubContext;

    public EquipesHub(
        PerguntaService perguntaService,
        SalaEquipesService salaService,
        IHubContext<EquipesHub> hubContext)
    {
        _perguntaService = perguntaService;
        _salaService = salaService;
        _hubContext = hubContext;
    }

    public async Task CriarSalaEquipes(CriarSalaEquipesRequest req)
    {
        var perguntas = _perguntaService.GetAleatorioParaHub(req.Quantidade, req.Dificuldade, req.Testamento);
        if (perguntas.Count == 0)
        {
            await Clients.Caller.SendAsync("ErroSala", "Nenhuma pergunta encontrada com os filtros selecionados.");
            return;
        }

        var nomeEquipe = req.NomeEquipe.Trim();
        var sala = new SalaEquipes
        {
            QuantidadePorEquipe = req.Quantidade,
            FiltroDificuldade = req.Dificuldade,
            FiltroTestamento = req.Testamento,
            Perguntas = perguntas,
            Equipes = [new EquipeSala { Nome = nomeEquipe, Pontos = 0 }],
            Jogadores = [new JogadorConectado(Context.ConnectionId, nomeEquipe, EhAnfitriao: true)]
        };

        var codigo = _salaService.CriarSala(sala);
        await Groups.AddToGroupAsync(Context.ConnectionId, codigo);

        await Clients.Caller.SendAsync("SalaCriada", new
        {
            codigoSala = codigo,
            minhaEquipe = nomeEquipe,
            estadoSala = BuildEstadoSala(sala)
        });
    }

    public async Task EntrarNaSalaEquipes(string codigo, string nomeEquipe)
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
            equipes = sala.Equipes.Select(e => new { e.Nome, e.Pontos }).ToList()
        });
    }

    public async Task IniciarJogoEquipes()
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
        }

        if (erroLock is not null) { await Clients.Caller.SendAsync("ErroSala", erroLock); return; }

        var perguntas = _perguntaService.GetAleatorioParaHub(
            sala!.QuantidadePorEquipe * sala.Equipes.Count,
            sala.FiltroDificuldade,
            sala.FiltroTestamento);

        if (perguntas.Count == 0)
        {
            await Clients.Caller.SendAsync("ErroSala", "Não há perguntas suficientes para iniciar o jogo com os filtros selecionados.");
            return;
        }

        lock (sala)
        {
            sala.Perguntas = perguntas;
            sala.Fase = FaseJogo.Transicao;
            sala.IndicePerguntaAtual = 0;
            sala.AddTimeUsesTurno = 0;
        }

        await Clients.Group(sala!.CodigoSala).SendAsync("ProximaRodada", BuildEstadoSala(sala));
    }

    public async Task MarcarProntoEquipes()
    {
        var (sala, erro) = GetSalaDoJogadorAtivo();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        PerguntaEquipesSala pergunta;
        lock (sala!)
        {
            if (sala.Fase != FaseJogo.Transicao)
            {
                _ = Clients.Caller.SendAsync("ErroSala", "Ação inválida nesta fase.");
                return;
            }

            sala.Fase = FaseJogo.Jogando;
            pergunta = sala.PerguntaAtual;
        }

        await Clients.Group(sala!.CodigoSala).SendAsync("PerguntaDaVez", BuildPerguntaDaVez(sala, pergunta));
    }

    public async Task AdicionarTempoEquipes()
    {
        var (sala, erro) = GetSalaDoJogadorAtivo();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        int addTimeUses;
        lock (sala!)
        {
            if (sala.Fase != FaseJogo.Jogando)
            {
                _ = Clients.Caller.SendAsync("ErroSala", "Ação inválida nesta fase.");
                return;
            }

            sala.AddTimeUsesTurno++;
            addTimeUses = sala.AddTimeUsesTurno;
        }

        await Clients.Group(sala!.CodigoSala).SendAsync("TempoAdicionado", new
        {
            addTimeUsesTurno = addTimeUses,
            nomeEquipe = sala.EquipeAtual.Nome
        });
    }

    public async Task ResponderEquipes(string resposta, int timerSecondsRestante)
    {
        var (sala, erro) = GetSalaDoJogadorAtivo();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        bool correta;
        int pontos;
        int indicePerguntaEsperado;
        PerguntaEquipesSala pergunta;
        string nomeEquipe;
        object equipes;

        lock (sala!)
        {
            if (sala.Fase != FaseJogo.Jogando)
            {
                _ = Clients.Caller.SendAsync("ErroSala", "Ação inválida nesta fase.");
                return;
            }

            pergunta = sala.PerguntaAtual;
            nomeEquipe = sala.EquipeAtual.Nome;
            correta = SameAnswer(pergunta.Resposta, resposta);
            pontos = correta
                ? Math.Max(0, BaseScore(pergunta.Dificuldade) + (timerSecondsRestante > 20 ? 1 : 0) - sala.AddTimeUsesTurno)
                : 0;

            if (correta)
                sala.EquipeAtual.Pontos += pontos;

            sala.Fase = FaseJogo.Transicao;
            equipes = sala.Equipes.Select(e => new { e.Nome, e.Pontos }).ToList();
            indicePerguntaEsperado = sala.IndicePerguntaAtual;
        }

        await Clients.Group(sala!.CodigoSala).SendAsync("ResultadoResposta", new
        {
            correta,
            respostaCorreta = pergunta.Resposta,
            perguntaTexto = pergunta.Texto,
            pontos,
            nomeEquipe,
            equipes
        });

        _ = AutoAvancarRodada(sala.CodigoSala, indicePerguntaEsperado);
    }

    public async Task AvancarRodadaEquipes()
    {
        var (sala, erro) = GetSalaDoAnfitriao();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        await AvancarParaProximaRodadaEquipes(sala!.CodigoSala, sala.IndicePerguntaAtual);
    }

    public async Task EntrarComoEspectadorEquipes(string codigo)
    {
        codigo = codigo.ToUpperInvariant().Trim();
        var sala = _salaService.ObterSala(codigo);
        if (sala is null)
        {
            await Clients.Caller.SendAsync("ErroSala", "Sala não encontrada.");
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, codigo);
        await Clients.Caller.SendAsync("EntradaEspectador", new { estadoSala = BuildEstadoSala(sala) });
    }

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

                if (jogoEncerrado || sala.Jogadores.Count == 0)
                    _salaService.RemoverSala(sala.CodigoSala);
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    private (SalaEquipes? sala, string? erro) GetSalaDoJogador()
    {
        var sala = _salaService.SalaDoJogador(Context.ConnectionId);
        return sala is null ? (null, "Você não está em nenhuma sala.") : (sala, null);
    }

    private (SalaEquipes? sala, string? erro) GetSalaDoAnfitriao()
    {
        var (sala, erro) = GetSalaDoJogador();
        if (erro is not null) return (null, erro);

        var jogador = sala!.Jogadores.FirstOrDefault(j => j.ConnectionId == Context.ConnectionId);
        return jogador is null || !jogador.EhAnfitriao
            ? (null, "Somente o anfitrião pode executar esta ação.")
            : (sala, null);
    }

    private (SalaEquipes? sala, string? erro) GetSalaDoJogadorAtivo()
    {
        var (sala, erro) = GetSalaDoJogador();
        if (erro is not null) return (null, erro);

        var jogador = sala!.Jogadores.FirstOrDefault(j => j.ConnectionId == Context.ConnectionId);
        if (jogador is null) return (null, "Você não está nesta sala.");

        return jogador.NomeEquipe != sala.EquipeAtual.Nome
            ? (null, "Não é a vez da sua equipe.")
            : (sala, null);
    }

    private object BuildEstadoSala(SalaEquipes sala) => new
    {
        codigoSala = sala.CodigoSala,
        fase = sala.Fase.ToString().ToLowerInvariant(),
        equipes = sala.Equipes.Select(e => new { e.Nome, e.Pontos }).ToList(),
        indiceEquipeAtual = sala.Equipes.Count > 0 ? sala.IndiceEquipeAtual : 0,
        nomeEquipeAtual = sala.Equipes.Count > 0 ? sala.EquipeAtual.Nome : "",
        indicePerguntaAtual = sala.IndicePerguntaAtual,
        totalPerguntas = sala.Perguntas.Count,
        perguntaAtual = sala.Fase == FaseJogo.Jogando && sala.Perguntas.Count > 0
            ? BuildPerguntaDaVez(sala, sala.PerguntaAtual)
            : null
    };

    private static object BuildPerguntaDaVez(SalaEquipes sala, PerguntaEquipesSala pergunta) => new
    {
        id = pergunta.Id,
        pergunta = pergunta.Texto,
        alternativas = pergunta.Alternativas,
        dificuldade = pergunta.Dificuldade,
        referencia = pergunta.Referencia,
        indicePergunta = sala.IndicePerguntaAtual
    };

    private async Task AutoAvancarRodada(string codigoSala, int indicePerguntaEsperado)
    {
        await Task.Delay(2500);
        await AvancarParaProximaRodadaEquipes(codigoSala, indicePerguntaEsperado);
    }

    private async Task AvancarParaProximaRodadaEquipes(string codigoSala, int indicePerguntaEsperado)
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
                sala.AddTimeUsesTurno = 0;
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

    private static int BaseScore(string dificuldade)
    {
        return dificuldade.Equals("facil", StringComparison.OrdinalIgnoreCase) ? 1
            : dificuldade.Equals("medio", StringComparison.OrdinalIgnoreCase) ? 2
            : 3;
    }

    private static bool SameAnswer(string left, string right)
    {
        return NormalizeAnswer(left).Equals(NormalizeAnswer(right), StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizeAnswer(string value)
    {
        return string.Join(' ', value.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }
}
