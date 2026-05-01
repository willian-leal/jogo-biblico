namespace JogoBiblicoBackend.Models;

public class QuestionReport
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string Modo { get; set; } = string.Empty;
    public string? PerguntaId { get; set; }
    public string? Contexto { get; set; }
    public string Motivo { get; set; } = string.Empty;
    public string? Detalhe { get; set; }
    public string Status { get; set; } = "novo";
}

public class QuestionSuggestion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string Nome { get; set; } = string.Empty;
    public string? Contato { get; set; }
    public string Pergunta { get; set; } = string.Empty;
    public string? AlternativaA { get; set; }
    public string? AlternativaB { get; set; }
    public string? AlternativaC { get; set; }
    public string? AlternativaD { get; set; }
    public string RespostaCorreta { get; set; } = string.Empty;
    public string? Referencia { get; set; }
    public string Dificuldade { get; set; } = "medio";
    public string Testamento { get; set; } = "";
    public string? Observacao { get; set; }
    public string Status { get; set; } = "nova";
}

public record QuestionReportDto(
    Guid Id,
    DateTime CreatedAt,
    string Modo,
    string? PerguntaId,
    string? Contexto,
    string Motivo,
    string? Detalhe,
    string Status);

public record QuestionSuggestionRequest(
    string Nome,
    string? Contato,
    string Pergunta,
    string? AlternativaA,
    string? AlternativaB,
    string? AlternativaC,
    string? AlternativaD,
    string RespostaCorreta,
    string? Referencia,
    string Dificuldade,
    string Testamento,
    string? Observacao);

public record QuestionSuggestionDto(
    Guid Id,
    DateTime CreatedAt,
    string Nome,
    string? Contato,
    string Pergunta,
    string? AlternativaA,
    string? AlternativaB,
    string? AlternativaC,
    string? AlternativaD,
    string RespostaCorreta,
    string? Referencia,
    string Dificuldade,
    string Testamento,
    string? Observacao,
    string Status);

public record UpdateStatusRequest(string Status);
