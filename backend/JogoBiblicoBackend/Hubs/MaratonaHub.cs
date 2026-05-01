using JogoBiblicoBackend.Models;
using JogoBiblicoBackend.Services;
using Microsoft.AspNetCore.SignalR;

namespace JogoBiblicoBackend.Hubs;

public record ModoMaratonaRequest(string Tipo, int QuantidadePorEquipe, string? Dificuldade, string? Testamento);
public record CriarSalaMaratonaRequest(string NomeEquipe, List<ModoMaratonaRequest> Modos);

public class MaratonaHub : Hub
{
    private readonly PerguntaService _perguntaService;
    private readonly SalaMaratonaService _salaService;
    private readonly IHubContext<MaratonaHub> _hubContext;

    public MaratonaHub(PerguntaService perguntaService, SalaMaratonaService salaService, IHubContext<MaratonaHub> hubContext)
    {
        _perguntaService = perguntaService;
        _salaService = salaService;
        _hubContext = hubContext;
    }

    public async Task CriarSalaMaratona(CriarSalaMaratonaRequest req)
    {
        if (req.Modos.Count == 0)
        {
            await Clients.Caller.SendAsync("ErroSala", "Selecione pelo menos um modo.");
            return;
        }

        var modos = req.Modos.Select(m => new ModoMaratonaConfig
        {
            Tipo = ParseTipo(m.Tipo),
            QuantidadePorEquipe = Math.Max(1, m.QuantidadePorEquipe),
            Dificuldade = m.Dificuldade,
            Testamento = m.Testamento
        }).ToList();

        var nomeEquipe = req.NomeEquipe.Trim();
        var sala = new SalaMaratona
        {
            Modos = modos,
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

    public async Task EntrarNaSalaMaratona(string codigo, string nomeEquipe)
    {
        codigo = codigo.ToUpperInvariant().Trim();
        nomeEquipe = nomeEquipe.Trim();

        var sala = _salaService.ObterSala(codigo);
        if (sala is null) { await Clients.Caller.SendAsync("ErroSala", "Sala não encontrada."); return; }

        string? erroLock = null;
        lock (sala)
        {
            if (sala.Fase != FaseMaratona.Aguardando)
                erroLock = "O jogo já começou.";
            else if (sala.Equipes.Any(e => e.Nome.Equals(nomeEquipe, StringComparison.OrdinalIgnoreCase)))
                erroLock = "Já existe uma equipe com esse nome.";
            else
            {
                sala.Equipes.Add(new EquipeSala { Nome = nomeEquipe, Pontos = 0 });
                sala.Jogadores.Add(new JogadorConectado(Context.ConnectionId, nomeEquipe, EhAnfitriao: false));
            }
        }

        if (erroLock is not null) { await Clients.Caller.SendAsync("ErroSala", erroLock); return; }

        _salaService.RegistrarConexao(Context.ConnectionId, codigo);
        await Groups.AddToGroupAsync(Context.ConnectionId, codigo);
        await Clients.Caller.SendAsync("EntradaConfirmada", new { minhaEquipe = nomeEquipe, estadoSala = BuildEstadoSala(sala) });
        await Clients.OthersInGroup(codigo).SendAsync("JogadorEntrou", new
        {
            nomeEquipe,
            equipes = sala.Equipes.Select(e => new { e.Nome, e.Pontos }).ToList()
        });
    }

    public async Task EntrarComoEspectadorMaratona(string codigo)
    {
        codigo = codigo.ToUpperInvariant().Trim();
        var sala = _salaService.ObterSala(codigo);
        if (sala is null) { await Clients.Caller.SendAsync("ErroSala", "Sala não encontrada."); return; }

        await Groups.AddToGroupAsync(Context.ConnectionId, codigo);
        await Clients.Caller.SendAsync("EntradaEspectador", new { estadoSala = BuildEstadoSala(sala) });
    }

    public async Task IniciarMaratona()
    {
        var (sala, erro) = GetSalaDoAnfitriao();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        string? erroLock = null;
        lock (sala!)
        {
            if (sala.Fase != FaseMaratona.Aguardando) erroLock = "O jogo já foi iniciado.";
            else if (sala.Equipes.Count < 2) erroLock = "São necessárias pelo menos 2 equipes.";
        }
        if (erroLock is not null) { await Clients.Caller.SendAsync("ErroSala", erroLock); return; }

        var perguntas = CarregarPerguntasModo(sala!, sala!.Modos[0]);
        if (perguntas.Count == 0)
        {
            await Clients.Caller.SendAsync("ErroSala", "Não há perguntas suficientes para o primeiro modo.");
            return;
        }

        lock (sala)
        {
            sala.PerguntasDoModo = perguntas;
            sala.IndiceModosAtual = 0;
            sala.IndicePerguntaAtual = 0;
            sala.IndiceEquipeAtual = 0;
            sala.AddTimeUsesTurno = 0;
            sala.Fase = FaseMaratona.TransicaoPergunta;
            if (sala.ModoAtual.Tipo == TipoModoMaratona.Forca)
                InicializarForca(sala);
        }

        await Clients.Group(sala.CodigoSala).SendAsync("ProximaRodada", BuildEstadoSala(sala));
    }

    public async Task IniciarProximoModo()
    {
        var (sala, erro) = GetSalaDoAnfitriao();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        string? erroLock = null;
        lock (sala!)
        {
            if (sala.Fase != FaseMaratona.TransicaoModo) erroLock = "Ação inválida nesta fase.";
        }
        if (erroLock is not null) { await Clients.Caller.SendAsync("ErroSala", erroLock); return; }

        var perguntas = CarregarPerguntasModo(sala!, sala!.ModoAtual);
        if (perguntas.Count == 0)
        {
            await Clients.Caller.SendAsync("ErroSala", "Não há perguntas suficientes para este modo.");
            return;
        }

        lock (sala)
        {
            sala.PerguntasDoModo = perguntas;
            sala.IndicePerguntaAtual = 0;
            sala.IndiceEquipeAtual = 0;
            sala.AddTimeUsesTurno = 0;
            sala.Fase = FaseMaratona.TransicaoPergunta;
            if (sala.ModoAtual.Tipo == TipoModoMaratona.Forca)
                InicializarForca(sala);
        }

        await Clients.Group(sala.CodigoSala).SendAsync("ProximaRodada", BuildEstadoSala(sala));
    }

    public async Task MarcarProntoMaratona()
    {
        var (sala, erro) = GetSalaDoJogadorAtivo();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        TipoModoMaratona tipo;
        PerguntaMaratonaSala pergunta;
        string nomeEquipe;
        int indicePergunta;

        lock (sala!)
        {
            if (sala.Fase != FaseMaratona.TransicaoPergunta) { _ = Clients.Caller.SendAsync("ErroSala", "Ação inválida nesta fase."); return; }
            sala.Fase = FaseMaratona.Jogando;
            tipo = sala.ModoAtual.Tipo;
            pergunta = sala.PerguntaAtual;
            nomeEquipe = sala.EquipeAtual.Nome;
            indicePergunta = sala.IndicePerguntaAtual;
        }

        switch (tipo)
        {
            case TipoModoMaratona.Quiz:
            case TipoModoMaratona.VerdadeiroOuFalso:
                await Clients.Group(sala.CodigoSala).SendAsync("PerguntaDaVez", new
                {
                    id = pergunta.Id,
                    pergunta = pergunta.Texto,
                    alternativas = pergunta.Alternativas,
                    dificuldade = pergunta.Dificuldade,
                    referencia = pergunta.Referencia,
                    indicePergunta
                });
                break;

            case TipoModoMaratona.Forca:
                await Clients.Group(sala.CodigoSala).SendAsync("ForcaIniciada", new
                {
                    dica = pergunta.Texto,
                    mascara = sala.MascaraAtual,
                    letrasUsadas = sala.LetrasUsadas.ToList(),
                    letrasErradas = sala.LetrasErradas.ToList(),
                    dificuldade = pergunta.Dificuldade,
                    referencia = pergunta.Referencia,
                    indicePergunta,
                    nomeEquipeAtual = nomeEquipe
                });
                break;

            case TipoModoMaratona.QuemSouEu:
                var jogadorAtivo = sala.Jogadores.FirstOrDefault(j => j.NomeEquipe == nomeEquipe);
                if (jogadorAtivo is not null)
                    await Clients.Client(jogadorAtivo.ConnectionId).SendAsync("PersonagemParaMimar", new
                    {
                        personagem = pergunta.Resposta,
                        indicePergunta
                    });
                await Clients.GroupExcept(sala.CodigoSala,
                    jogadorAtivo is not null ? [jogadorAtivo.ConnectionId] : [])
                    .SendAsync("MimicaIniciada", new { nomeEquipeAtual = nomeEquipe, indicePergunta });
                break;
        }
    }

    // ── Quiz / VoF ──────────────────────────────────────────────────────────────
    public async Task ResponderMaratona(string resposta, int timerSecondsRestante)
    {
        var (sala, erro) = GetSalaDoJogadorAtivo();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        bool correta;
        int pontos;
        int indiceEsperado;
        PerguntaMaratonaSala pergunta;
        string nomeEquipe;
        object equipes;

        lock (sala!)
        {
            if (sala.Fase != FaseMaratona.Jogando) { _ = Clients.Caller.SendAsync("ErroSala", "Ação inválida."); return; }
            if (sala.ModoAtual.Tipo != TipoModoMaratona.Quiz && sala.ModoAtual.Tipo != TipoModoMaratona.VerdadeiroOuFalso)
            { _ = Clients.Caller.SendAsync("ErroSala", "Ação inválida para este modo."); return; }

            pergunta = sala.PerguntaAtual;
            nomeEquipe = sala.EquipeAtual.Nome;
            correta = SameAnswer(pergunta.Resposta, resposta);

            pontos = correta
                ? (sala.ModoAtual.Tipo == TipoModoMaratona.Quiz
                    ? Math.Max(0, BaseScore(pergunta.Dificuldade) + (timerSecondsRestante > 20 ? 1 : 0) - sala.AddTimeUsesTurno)
                    : 1)
                : 0;

            if (correta) sala.EquipeAtual.Pontos += pontos;
            sala.Fase = FaseMaratona.TransicaoPergunta;
            equipes = sala.Equipes.Select(e => new { e.Nome, e.Pontos }).ToList();
            indiceEsperado = sala.IndicePerguntaAtual;
        }

        await Clients.Group(sala.CodigoSala).SendAsync("ResultadoResposta", new
        {
            correta, respostaCorreta = pergunta.Resposta,
            perguntaTexto = pergunta.Texto, pontos, nomeEquipe, equipes
        });

        _ = AutoAvancar(sala.CodigoSala, indiceEsperado);
    }

    public async Task AdicionarTempoMaratona()
    {
        var (sala, erro) = GetSalaDoJogadorAtivo();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        int addTimeUses;
        lock (sala!)
        {
            if (sala.Fase != FaseMaratona.Jogando) { _ = Clients.Caller.SendAsync("ErroSala", "Ação inválida."); return; }
            sala.AddTimeUsesTurno++;
            addTimeUses = sala.AddTimeUsesTurno;
        }

        await Clients.Group(sala.CodigoSala).SendAsync("TempoAdicionado", new
        {
            addTimeUsesTurno = addTimeUses,
            nomeEquipe = sala.EquipeAtual.Nome
        });
    }

    // ── Quem Sou Eu ─────────────────────────────────────────────────────────────
    public async Task ResponderMimica(bool acertou)
    {
        var (sala, erro) = GetSalaDoJogadorAtivo();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        int pontos;
        int indiceEsperado;
        PerguntaMaratonaSala pergunta;
        string nomeEquipe;
        object equipes;

        lock (sala!)
        {
            if (sala.Fase != FaseMaratona.Jogando) { _ = Clients.Caller.SendAsync("ErroSala", "Ação inválida."); return; }
            if (sala.ModoAtual.Tipo != TipoModoMaratona.QuemSouEu) { _ = Clients.Caller.SendAsync("ErroSala", "Ação inválida para este modo."); return; }

            pergunta = sala.PerguntaAtual;
            nomeEquipe = sala.EquipeAtual.Nome;
            pontos = acertou ? 3 : 0;
            if (acertou) sala.EquipeAtual.Pontos += pontos;
            sala.Fase = FaseMaratona.TransicaoPergunta;
            equipes = sala.Equipes.Select(e => new { e.Nome, e.Pontos }).ToList();
            indiceEsperado = sala.IndicePerguntaAtual;
        }

        await Clients.Group(sala.CodigoSala).SendAsync("ResultadoMimica", new
        {
            acertou, personagem = pergunta.Resposta, pontos, nomeEquipe, equipes
        });

        _ = AutoAvancar(sala.CodigoSala, indiceEsperado);
    }

    // ── Forca ────────────────────────────────────────────────────────────────────
    public async Task EscolherLetraForca(string letra)
    {
        var (sala, erro) = GetSalaDoJogadorAtivo();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }

        string letraNorm;
        string? erroLock = null;
        lock (sala!)
        {
            if (sala.Fase != FaseMaratona.Jogando || sala.ModoAtual.Tipo != TipoModoMaratona.Forca)
                erroLock = "Ação inválida.";
            letraNorm = PerguntaService.NormalizarTextoForca(letra).FirstOrDefault().ToString();
            if (string.IsNullOrEmpty(letraNorm) || letraNorm == "\0") erroLock = "Letra inválida.";
            else if (sala.LetrasUsadas.Contains(letraNorm)) erroLock = "Letra já utilizada.";
        }
        if (erroLock is not null) { await Clients.Caller.SendAsync("ErroSala", erroLock); return; }

        bool acertou;
        bool finalizada;
        int indiceEquipeAtual;
        string nomeEquipeAtual;
        int pontos = 0;
        object equipes;
        List<string> mascara;
        int indiceEsperado;

        lock (sala!)
        {
            var palavraNorm = PerguntaService.NormalizarTextoForca(sala.PerguntaAtual.Resposta);
            acertou = palavraNorm.Contains(letraNorm);
            sala.LetrasUsadas.Add(letraNorm);

            if (acertou)
            {
                sala.EquipeAtual.Pontos += 1;
                pontos = 1;
            }
            else
            {
                sala.LetrasErradas.Add(letraNorm);
                sala.IndiceEquipeAtual = (sala.IndiceEquipeAtual + 1) % sala.Equipes.Count;
            }

            var reveladas = sala.LetrasUsadas.Except(sala.LetrasErradas).ToHashSet();
            sala.MascaraAtual = PerguntaService.ComputarMascaraForca(sala.PerguntaAtual.Resposta, reveladas);
            finalizada = !sala.MascaraAtual.Contains("_");

            if (finalizada) { sala.EquipeAtual.Pontos += 3; pontos += 3; }

            indiceEquipeAtual = sala.IndiceEquipeAtual;
            nomeEquipeAtual = sala.EquipeAtual.Nome;
            equipes = sala.Equipes.Select(e => new { e.Nome, e.Pontos }).ToList();
            mascara = sala.MascaraAtual;
            indiceEsperado = sala.IndicePerguntaAtual;
        }

        await Clients.Group(sala.CodigoSala).SendAsync("ResultadoLetra", new
        {
            letra = letraNorm, acertou, mascara, finalizada,
            respostaCorreta = finalizada ? sala.PerguntaAtual.Resposta : (string?)null,
            pontos, equipes, letrasUsadas = sala.LetrasUsadas.ToList(),
            letrasErradas = sala.LetrasErradas.ToList(), indiceEquipeAtual, nomeEquipeAtual
        });

        if (finalizada)
        {
            lock (sala) { sala.Fase = FaseMaratona.TransicaoPergunta; }
            _ = AutoAvancar(sala.CodigoSala, indiceEsperado);
        }
    }

    public async Task AbrirChuteMaratona()
    {
        var (sala, erro) = GetSalaDoJogadorAtivo();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }
        if (sala!.Fase != FaseMaratona.Jogando || sala.ModoAtual.Tipo != TipoModoMaratona.Forca)
        { await Clients.Caller.SendAsync("ErroSala", "Ação inválida."); return; }

        await Clients.Group(sala.CodigoSala).SendAsync("ChuteAberto", new { nomeEquipe = sala.EquipeAtual.Nome });
    }

    public async Task CancelarChuteMaratona()
    {
        var (sala, erro) = GetSalaDoJogadorAtivo();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }
        await Clients.Group(sala!.CodigoSala).SendAsync("ChuteCancelado", new { });
    }

    public async Task EnviarChuteMaratona(string resposta)
    {
        var (sala, erro) = GetSalaDoJogadorAtivo();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }
        if (sala!.Fase != FaseMaratona.Jogando || sala.ModoAtual.Tipo != TipoModoMaratona.Forca)
        { await Clients.Caller.SendAsync("ErroSala", "Ação inválida."); return; }

        var correta = SameAnswer(sala.PerguntaAtual.Resposta, resposta);
        int pontos = 0;
        int indiceEquipeAtual;
        string nomeEquipeAtual;
        object equipes;
        int indiceEsperado;

        lock (sala)
        {
            if (correta)
            {
                pontos = sala.LetrasUsadas.Count == 0 ? 5 : 0;
                sala.EquipeAtual.Pontos += pontos;
                sala.Fase = FaseMaratona.TransicaoPergunta;
            }
            else sala.IndiceEquipeAtual = (sala.IndiceEquipeAtual + 1) % sala.Equipes.Count;

            indiceEquipeAtual = sala.IndiceEquipeAtual;
            nomeEquipeAtual = sala.EquipeAtual.Nome;
            equipes = sala.Equipes.Select(e => new { e.Nome, e.Pontos }).ToList();
            indiceEsperado = sala.IndicePerguntaAtual;
        }

        await Clients.Group(sala.CodigoSala).SendAsync("ResultadoChute", new
        {
            correta, respostaCorreta = sala.PerguntaAtual.Resposta,
            pontos, equipes, indiceEquipeAtual, nomeEquipeAtual
        });

        if (correta) _ = AutoAvancar(sala.CodigoSala, indiceEsperado);
    }

    public async Task AvancarMaratona()
    {
        var (sala, erro) = GetSalaDoAnfitriao();
        if (erro is not null) { await Clients.Caller.SendAsync("ErroSala", erro); return; }
        await AvancarParaProximaRodada(sala!.CodigoSala, sala.IndicePerguntaAtual);
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
                    if (jogoEncerrado) sala.Fase = FaseMaratona.Encerrada;
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

    // ── Helpers ───────────────────────────────────────────────────────────────────
    private (SalaMaratona? sala, string? erro) GetSalaDoJogador()
    {
        var sala = _salaService.SalaDoJogador(Context.ConnectionId);
        return sala is null ? (null, "Você não está em nenhuma sala.") : (sala, null);
    }

    private (SalaMaratona? sala, string? erro) GetSalaDoAnfitriao()
    {
        var (sala, erro) = GetSalaDoJogador();
        if (erro is not null) return (null, erro);
        var jogador = sala!.Jogadores.FirstOrDefault(j => j.ConnectionId == Context.ConnectionId);
        return jogador is null || !jogador.EhAnfitriao
            ? (null, "Somente o anfitrião pode executar esta ação.")
            : (sala, null);
    }

    private (SalaMaratona? sala, string? erro) GetSalaDoJogadorAtivo()
    {
        var (sala, erro) = GetSalaDoJogador();
        if (erro is not null) return (null, erro);
        var jogador = sala!.Jogadores.FirstOrDefault(j => j.ConnectionId == Context.ConnectionId);
        if (jogador is null) return (null, "Você não está nesta sala.");
        return jogador.NomeEquipe != sala.EquipeAtual.Nome
            ? (null, "Não é a vez da sua equipe.")
            : (sala, null);
    }

    private List<PerguntaMaratonaSala> CarregarPerguntasModo(SalaMaratona sala, ModoMaratonaConfig modo)
    {
        var total = modo.QuantidadePorEquipe * sala.Equipes.Count;
        return _perguntaService.GetParaMaratona(modo.Tipo, total, modo.Dificuldade, modo.Testamento);
    }

    private static void InicializarForca(SalaMaratona sala)
    {
        sala.LetrasUsadas = [];
        sala.LetrasErradas = [];
        sala.MascaraAtual = PerguntaService.ComputarMascaraForca(sala.PerguntaAtual.Resposta, []);
    }

    private object BuildEstadoSala(SalaMaratona sala)
    {
        var modo = sala.Fase != FaseMaratona.Aguardando ? TipoToSlug(sala.ModoAtual.Tipo) : "";
        return new
        {
            codigoSala = sala.CodigoSala,
            fase = sala.Fase.ToString().ToLowerInvariant(),
            modoAtual = modo,
            indiceModosAtual = sala.IndiceModosAtual,
            totalModos = sala.Modos.Count,
            modos = sala.Modos.Select(m => new { tipo = TipoToSlug(m.Tipo), m.QuantidadePorEquipe }),
            equipes = sala.Equipes.Select(e => new { e.Nome, e.Pontos }).ToList(),
            indiceEquipeAtual = sala.IndiceEquipeAtual,
            nomeEquipeAtual = sala.Equipes.Count > 0 ? sala.EquipeAtual.Nome : "",
            indicePerguntaAtual = sala.IndicePerguntaAtual,
            totalPerguntasDoModo = sala.Fase != FaseMaratona.Aguardando && sala.Fase != FaseMaratona.TransicaoModo && sala.PerguntasDoModo.Count > 0
                ? sala.TotalPerguntasDoModo : 0,
            // Forca state
            mascara = sala.MascaraAtual,
            letrasUsadas = sala.LetrasUsadas.ToList(),
            letrasErradas = sala.LetrasErradas.ToList(),
            dica = sala.PerguntasDoModo.Count > 0 && sala.ModoAtual.Tipo == TipoModoMaratona.Forca
                ? sala.PerguntaAtual.Texto : null,
            // Current question for reconnect (quiz/vof only, never reveals answers)
            perguntaAtual = sala.Fase == FaseMaratona.Jogando && sala.PerguntasDoModo.Count > 0
                && (sala.ModoAtual.Tipo == TipoModoMaratona.Quiz || sala.ModoAtual.Tipo == TipoModoMaratona.VerdadeiroOuFalso)
                ? (object)new
                {
                    id = sala.PerguntaAtual.Id,
                    pergunta = sala.PerguntaAtual.Texto,
                    alternativas = sala.PerguntaAtual.Alternativas,
                    dificuldade = sala.PerguntaAtual.Dificuldade,
                    referencia = sala.PerguntaAtual.Referencia,
                    indicePergunta = sala.IndicePerguntaAtual
                }
                : null
        };
    }

    private async Task AutoAvancar(string codigoSala, int indiceEsperado)
    {
        await Task.Delay(2500);
        await AvancarParaProximaRodada(codigoSala, indiceEsperado);
    }

    private async Task AvancarParaProximaRodada(string codigoSala, int indiceEsperado)
    {
        var sala = _salaService.ObterSala(codigoSala);
        if (sala is null) return;

        bool encerrada;
        bool transicaoModo = false;
        object? rankingModo = null;
        string? proximoModo = null;

        lock (sala)
        {
            if (sala.IndicePerguntaAtual != indiceEsperado) return;
            if (sala.Fase == FaseMaratona.Encerrada) return;

            if (sala.IndicePerguntaAtual < sala.PerguntasDoModo.Count - 1)
            {
                sala.IndicePerguntaAtual++;
                sala.IndiceEquipeAtual = sala.IndicePerguntaAtual % sala.Equipes.Count;
                sala.AddTimeUsesTurno = 0;
                sala.Fase = FaseMaratona.TransicaoPergunta;
                if (sala.ModoAtual.Tipo == TipoModoMaratona.Forca) InicializarForca(sala);
                encerrada = false;
            }
            else if (sala.IndiceModosAtual < sala.Modos.Count - 1)
            {
                sala.IndiceModosAtual++;
                sala.Fase = FaseMaratona.TransicaoModo;
                encerrada = false;
                transicaoModo = true;
                rankingModo = sala.Equipes.OrderByDescending(e => e.Pontos).Select(e => new { e.Nome, e.Pontos }).ToList();
                proximoModo = TipoToSlug(sala.ModoAtual.Tipo);
            }
            else
            {
                sala.Fase = FaseMaratona.Encerrada;
                encerrada = true;
            }
        }

        if (encerrada)
        {
            await _hubContext.Clients.Group(codigoSala).SendAsync("MaratonaEncerrada", new
            {
                ranking = sala.Equipes.OrderByDescending(e => e.Pontos).Select(e => new { e.Nome, e.Pontos }).ToList()
            });
        }
        else if (transicaoModo)
        {
            await _hubContext.Clients.Group(codigoSala).SendAsync("TransicaoModo", new
            {
                ranking = rankingModo,
                proximoModo,
                indiceModosAtual = sala.IndiceModosAtual,
                totalModos = sala.Modos.Count
            });
        }
        else
        {
            await _hubContext.Clients.Group(codigoSala).SendAsync("ProximaRodada", BuildEstadoSala(sala));
        }
    }

    private static TipoModoMaratona ParseTipo(string tipo) => tipo.ToLowerInvariant() switch
    {
        "vof" or "verdadeirooufalso" => TipoModoMaratona.VerdadeiroOuFalso,
        "forca" => TipoModoMaratona.Forca,
        "quemsoueu" => TipoModoMaratona.QuemSouEu,
        _ => TipoModoMaratona.Quiz
    };

    private static string TipoToSlug(TipoModoMaratona tipo) => tipo switch
    {
        TipoModoMaratona.VerdadeiroOuFalso => "vof",
        TipoModoMaratona.Forca => "forca",
        TipoModoMaratona.QuemSouEu => "quemsoueu",
        _ => "quiz"
    };

    private static int BaseScore(string dificuldade) =>
        dificuldade.Equals("facil", StringComparison.OrdinalIgnoreCase) ? 1
        : dificuldade.Equals("medio", StringComparison.OrdinalIgnoreCase) ? 2
        : 3;

    private static bool SameAnswer(string left, string right) =>
        string.Join(' ', left.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries))
            .Equals(string.Join(' ', right.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries)),
                StringComparison.OrdinalIgnoreCase);
}
