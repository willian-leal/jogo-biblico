using System.Text.Json;
using JogoBiblicoBackend.Models;

namespace JogoBiblicoBackend.Services;

public class PerguntaService
{
    private readonly List<Pergunta> _perguntas;
    private readonly Dictionary<string, List<string>> _vofSessions = new();
    private readonly object _vofSessionsLock = new();

    public PerguntaService(IWebHostEnvironment env)
    {
        var filePath = Path.Combine(env.ContentRootPath, "Data", "banco_biblico_completo.json");
        var json = File.ReadAllText(filePath);
        _perguntas = JsonSerializer.Deserialize<List<Pergunta>>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }) ?? [];
    }

    public List<PerguntaPublicaDto> GetAleatorio(int quantidade, string? dificuldade, string? testamento)
    {
        var query = _perguntas.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(dificuldade))
            query = query.Where(p => p.Dificuldade.Equals(dificuldade, StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrWhiteSpace(testamento))
            query = query.Where(p => p.Testamento.Equals(testamento, StringComparison.OrdinalIgnoreCase));

        return query
            .OrderBy(_ => Guid.NewGuid())
            .Take(quantidade)
            .Select(p => new PerguntaPublicaDto(p.Id, p.Texto, p.Referencia, p.Testamento, p.Dificuldade, p.Alternativas))
            .ToList();
    }

    public List<VofPerguntaPublicaDto> GetVerdadeiroOuFalso(int quantidade, string? dificuldade, string? testamento)
    {
        var perguntas = GetPerguntasFiltradas(dificuldade, testamento)
            .Where(p => p.Alternativas.Any(a => !SameAnswer(a, p.Resposta)))
            .OrderBy(_ => Guid.NewGuid())
            .Take(quantidade)
            .ToList();

        var sessaoId = Guid.NewGuid().ToString("N");
        var gabaritos = new List<string>();
        var result = new List<VofPerguntaPublicaDto>();

        for (var index = 0; index < perguntas.Count; index++)
        {
            var pergunta = perguntas[index];
            var isTrue = Random.Shared.Next(2) == 0;
            var answer = isTrue ? pergunta.Resposta : PickWrongAlternative(pergunta);
            var gabarito = isTrue ? "verdadeiro" : "falso";
            var afirmacao = $"{RemoveQuestionMark(pergunta.Texto)} \u2192 {answer} \u2014 Verdadeiro ou Falso?";

            gabaritos.Add(gabarito);
            result.Add(new VofPerguntaPublicaDto(sessaoId, index, pergunta.Id, afirmacao));
        }

        lock (_vofSessionsLock)
        {
            _vofSessions[sessaoId] = gabaritos;
        }

        return result;
    }

    public VerificarResponse? VerificarResposta(string id, string resposta)
    {
        var pergunta = _perguntas.FirstOrDefault(p => p.Id == id);
        if (pergunta is null) return null;

        var correta = SameAnswer(pergunta.Resposta, resposta);
        return new VerificarResponse(correta, pergunta.Resposta);
    }

    public VofVerificarResponse? VerificarVerdadeiroOuFalso(string sessaoId, int indice, string resposta)
    {
        string? gabarito;
        lock (_vofSessionsLock)
        {
            if (!_vofSessions.TryGetValue(sessaoId, out var gabaritos) || indice < 0 || indice >= gabaritos.Count)
                return null;

            gabarito = gabaritos[indice];
        }

        var correta = gabarito.Equals(resposta.Trim(), StringComparison.OrdinalIgnoreCase);
        return new VofVerificarResponse(correta, gabarito);
    }

    private IEnumerable<Pergunta> GetPerguntasFiltradas(string? dificuldade, string? testamento)
    {
        var query = _perguntas.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(dificuldade))
            query = query.Where(p => p.Dificuldade.Equals(dificuldade, StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrWhiteSpace(testamento))
            query = query.Where(p => p.Testamento.Equals(testamento, StringComparison.OrdinalIgnoreCase));

        return query;
    }

    private static string PickWrongAlternative(Pergunta pergunta)
    {
        return pergunta.Alternativas
            .Where(a => !SameAnswer(a, pergunta.Resposta))
            .OrderBy(_ => Guid.NewGuid())
            .First();
    }

    private static string RemoveQuestionMark(string text)
    {
        return text.Trim().TrimEnd('?', ' ', '\t', '\r', '\n');
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
