using System.Text.Json.Serialization;

namespace JogoBiblicoBackend.Models;

public class Pergunta
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("pergunta")]
    public string Texto { get; set; } = "";

    [JsonPropertyName("resposta")]
    public string Resposta { get; set; } = "";

    [JsonPropertyName("referencia")]
    public string Referencia { get; set; } = "";

    [JsonPropertyName("testamento")]
    public string Testamento { get; set; } = "";

    [JsonPropertyName("dificuldade")]
    public string Dificuldade { get; set; } = "";

    [JsonPropertyName("fonte")]
    public string Fonte { get; set; } = "";

    [JsonPropertyName("alternativas")]
    public List<string> Alternativas { get; set; } = new();
}
