namespace JogoBiblicoBackend.Models;

public enum FaseJogo { Aguardando, Transicao, Jogando, Encerrada }

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
