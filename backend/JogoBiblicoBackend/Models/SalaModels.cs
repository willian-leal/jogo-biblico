namespace JogoBiblicoBackend.Models;

public enum FaseJogo { Aguardando, Transicao, Jogando, Encerrada }

public enum TipoModoMaratona { Quiz, VerdadeiroOuFalso, Forca, QuemSouEu }
public enum FaseMaratona { Aguardando, TransicaoModo, TransicaoPergunta, Jogando, Encerrada }

public class ModoMaratonaConfig
{
    public TipoModoMaratona Tipo { get; set; }
    public int QuantidadePorEquipe { get; set; }
    public string? Dificuldade { get; set; }
    public string? Testamento { get; set; }
}

public class PerguntaMaratonaSala
{
    public string Id { get; set; } = "";
    public string Texto { get; set; } = "";
    public string Resposta { get; set; } = "";
    public string Referencia { get; set; } = "";
    public string Dificuldade { get; set; } = "";
    public List<string> Alternativas { get; set; } = [];
}

public class SalaMaratona
{
    public string CodigoSala { get; set; } = "";
    public List<ModoMaratonaConfig> Modos { get; set; } = [];
    public List<EquipeSala> Equipes { get; set; } = [];
    public List<JogadorConectado> Jogadores { get; set; } = [];
    public int IndiceModosAtual { get; set; }
    public int IndiceEquipeAtual { get; set; }
    public List<PerguntaMaratonaSala> PerguntasDoModo { get; set; } = [];
    public int IndicePerguntaAtual { get; set; }
    public int AddTimeUsesTurno { get; set; }
    public FaseMaratona Fase { get; set; } = FaseMaratona.Aguardando;
    public DateTimeOffset CriadaEm { get; set; } = DateTimeOffset.UtcNow;

    // Estado específico da Forca
    public List<string> MascaraAtual { get; set; } = [];
    public HashSet<string> LetrasUsadas { get; set; } = [];
    public HashSet<string> LetrasErradas { get; set; } = [];

    public ModoMaratonaConfig ModoAtual => Modos[IndiceModosAtual];
    public PerguntaMaratonaSala PerguntaAtual => PerguntasDoModo[IndicePerguntaAtual];
    public EquipeSala EquipeAtual => Equipes[IndiceEquipeAtual];
    public int TotalPerguntasDoModo => ModoAtual.QuantidadePorEquipe * Equipes.Count;
}

public class PerguntaEquipesSala
{
    public string Id { get; set; } = "";
    public string Texto { get; set; } = "";
    public string Resposta { get; set; } = "";
    public string Referencia { get; set; } = "";
    public string Dificuldade { get; set; } = "";
    public List<string> Alternativas { get; set; } = [];
}

public class SalaEquipes
{
    public string CodigoSala { get; set; } = "";
    public int QuantidadePorEquipe { get; set; }
    public string? FiltroDificuldade { get; set; }
    public string? FiltroTestamento { get; set; }
    public List<PerguntaEquipesSala> Perguntas { get; set; } = [];
    public List<EquipeSala> Equipes { get; set; } = [];
    public List<JogadorConectado> Jogadores { get; set; } = [];
    public int IndicePerguntaAtual { get; set; }
    public int AddTimeUsesTurno { get; set; }
    public FaseJogo Fase { get; set; } = FaseJogo.Aguardando;
    public DateTimeOffset CriadaEm { get; set; } = DateTimeOffset.UtcNow;

    public int IndiceEquipeAtual => IndicePerguntaAtual % Equipes.Count;
    public PerguntaEquipesSala PerguntaAtual => Perguntas[IndicePerguntaAtual];
    public EquipeSala EquipeAtual => Equipes[IndiceEquipeAtual];
}

public class EquipeSala
{
    public string Nome { get; set; } = "";
    public int Pontos { get; set; }
}

public record JogadorConectado(string ConnectionId, string NomeEquipe, bool EhAnfitriao);

public class SalaForca
{
    public string CodigoSala { get; set; } = "";
    public string SessaoId { get; set; } = "";
    public List<ForcaPerguntaPublicaDto> Perguntas { get; set; } = [];
    public List<EquipeSala> Equipes { get; set; } = [];
    public List<JogadorConectado> Jogadores { get; set; } = [];
    public int IndicePerguntaAtual { get; set; }
    public int IndiceEquipeAtual { get; set; }
    public List<string> MascaraAtual { get; set; } = [];
    public HashSet<string> LetrasUsadas { get; set; } = [];
    public HashSet<string> LetrasErradas { get; set; } = [];
    public FaseJogo Fase { get; set; } = FaseJogo.Aguardando;
    public DateTimeOffset CriadaEm { get; set; } = DateTimeOffset.UtcNow;

    public ForcaPerguntaPublicaDto PerguntaAtual => Perguntas[IndicePerguntaAtual];
    public EquipeSala EquipeAtual => Equipes[IndiceEquipeAtual];
}
