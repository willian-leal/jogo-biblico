namespace JogoBiblicoBackend.Models;

public record PerguntaPublicaDto(
    string Id,
    string Pergunta,
    string Referencia,
    string Testamento,
    string Dificuldade,
    List<string> Alternativas);

public record VerificarRequest(string Id, string Resposta);

public record VerificarResponse(bool Correta, string RespostaCorreta);

public record VofPerguntaPublicaDto(
    string SessaoId,
    int Indice,
    string Id,
    string Afirmacao);

public record VofVerificarRequest(string SessaoId, int Indice, string Resposta);

public record VofVerificarResponse(bool Correta, string Gabarito);
