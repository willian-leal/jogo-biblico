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

public record ForcaPerguntaPublicaDto(
    string SessaoId,
    int Indice,
    string Id,
    string Dica,
    List<string> Mascara,
    string Dificuldade,
    string Testamento);

public record ForcaLetraRequest(string SessaoId, int Indice, string Letra);

public record ForcaLetraResponse(
    bool Acertou,
    List<string> Mascara,
    bool Finalizada,
    string? RespostaCorreta);

public record ForcaChuteRequest(string SessaoId, int Indice, string Resposta);

public record ForcaChuteResponse(bool Correta, string RespostaCorreta, bool Finalizada);

public record CruzadinhaPublicaDto(
    string SessaoId,
    int Tamanho,
    List<CruzadinhaPalavraPublicaDto> Palavras);

public record CruzadinhaPalavraPublicaDto(
    string Id,
    int Numero,
    string Dica,
    int Linha,
    int Coluna,
    string Direcao,
    int Tamanho);

public record CruzadinhaRespostaRequest(string Id, string Resposta);

public record CruzadinhaVerificarRequest(
    string SessaoId,
    List<CruzadinhaRespostaRequest> Respostas);

public record CruzadinhaVerificarResponse(
    List<string> Corretas,
    List<string> Erradas,
    bool Concluida);

public record RelatarProblemaRequest(
    string Modo,
    string? PerguntaId,
    string? Contexto,
    string Motivo,
    string? Detalhe);
