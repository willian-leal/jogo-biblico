using System.Text.Json;
using JogoBiblicoBackend.Models;

namespace JogoBiblicoBackend.Services;

public class PerguntaService
{
    private readonly List<Pergunta> _perguntas;
    private readonly List<ForcaDesafio> _forcaDesafios = [
        new("jonas", "Jonas", "Foi engolido por um grande peixe", "facil", "AT", "Jonas 1"),
        new("moises", "Moises", "Liderou o povo de Israel na saida do Egito", "facil", "AT", "Exodo 14"),
        new("davi", "Davi", "Venceu Golias usando uma funda", "facil", "AT", "1 Samuel 17"),
        new("daniel", "Daniel", "Foi lancado na cova dos leoes", "facil", "AT", "Daniel 6"),
        new("noe", "Noe", "Construiu uma arca antes do diluvio", "facil", "AT", "Genesis 6"),
        new("ester", "Ester", "Arriscou a vida para defender seu povo", "medio", "AT", "Ester 4"),
        new("gideao", "Gideao", "Venceu uma batalha com apenas trezentos homens", "medio", "AT", "Juizes 7"),
        new("samuel", "Samuel", "Ouviu Deus chama-lo ainda menino", "medio", "AT", "1 Samuel 3"),
        new("pedro", "Pedro", "Andou sobre as aguas por alguns instantes", "facil", "NT", "Mateus 14"),
        new("paulo", "Paulo", "Antes de se converter, perseguia os discipulos", "facil", "NT", "Atos 9"),
        new("zaqueu", "Zaqueu", "Subiu em uma arvore para ver Jesus", "medio", "NT", "Lucas 19"),
        new("nicodemos", "Nicodemos", "Visitou Jesus durante a noite", "medio", "NT", "Joao 3"),
        new("bartimeu", "Bartimeu", "Era cego e clamou por Jesus perto de Jerico", "medio", "NT", "Marcos 10"),
        new("melquisedeque", "Melquisedeque", "Foi rei de Salem e sacerdote do Deus Altissimo", "dificil", "AT", "Genesis 14"),
        new("filemom", "Filemom", "Recebeu uma carta de Paulo sobre Onesimo", "dificil", "NT", "Filemom 1")
    ];
    private readonly List<CruzadinhaPuzzle> _cruzadinhas = [
        new(
            "nt-personagens-1",
            "medio",
            "NT",
            9,
            [
                new("jesus", 1, "JESUS", "Realizou muitos milagres e ensinou por parabolas", 4, 2, "horizontal"),
                new("moises", 2, "MOISES", "Apareceu com Elias na transfiguracao", 1, 4, "vertical"),
                new("pedro", 3, "PEDRO", "Negou Jesus tres vezes antes do galo cantar", 3, 3, "vertical"),
                new("paulo", 4, "PAULO", "Escreveu cartas para varias congregacoes", 2, 5, "vertical"),
                new("sara", 5, "SARA", "Esposa de Abraao mencionada como exemplo de fe", 4, 6, "vertical")
            ]),
        new(
            "at-personagens-1",
            "facil",
            "AT",
            10,
            [
                new("davi", 1, "DAVI", "Venceu Golias usando uma funda", 4, 2, "horizontal"),
                new("daniel", 2, "DANIEL", "Foi lancado na cova dos leoes", 4, 2, "vertical"),
                new("sara", 3, "SARA", "Esposa de Abraao", 5, 1, "horizontal"),
                new("jonas", 4, "JONAS", "Tentou fugir de uma designacao e foi engolido por um grande peixe", 6, 0, "horizontal")
            ]),
        new(
            "nt-facil-1",
            "facil",
            "NT",
            8,
            [
                // JESUS(3,2)h intersects JOAO(3,2)v at J, PEDRO(2,3)v at E
                // PAULO(2,3)h intersects PEDRO(2,3)v at P
                // MARIA(5,1)h intersects JOAO(3,2)v at A(5,2), PEDRO(2,3)v at R(5,3)
                new("jesus", 1, "JESUS", "Filho de Deus que ensinou o amor ao proximo", 3, 2, "horizontal"),
                new("joao", 2, "JOAO", "O discipulo amado que escreveu o quarto Evangelho", 3, 2, "vertical"),
                new("pedro", 3, "PEDRO", "Pescador que se tornou lider dos apostolos", 2, 3, "vertical"),
                new("paulo", 4, "PAULO", "Perseguia os cristaos antes de se converter no caminho de Damasco", 2, 3, "horizontal"),
                new("maria", 5, "MARIA", "Mae de Jesus, virgem que recebeu o anuncio do anjo", 5, 1, "horizontal")
            ]),
        new(
            "at-facil-2",
            "facil",
            "AT",
            7,
            [
                // DAVI(0,3)h intersects DANIEL(0,3)v at D
                // NOE(2,3)h intersects DANIEL(0,3)v at N(2,3)
                // MOISES(3,1)h intersects DANIEL(0,3)v at I(3,3)
                // ESTER(2,6)v intersects MOISES(3,1)h at S(3,6)
                new("davi", 1, "DAVI", "Rei de Israel que venceu Golias com uma funda", 0, 3, "horizontal"),
                new("daniel", 2, "DANIEL", "Foi lancado na cova dos leoes e saiu ileso", 0, 3, "vertical"),
                new("noe", 3, "NOE", "Construiu uma arca e sobreviveu ao diluvio com sua familia", 2, 3, "horizontal"),
                new("moises", 4, "MOISES", "Liderou os israelitas na saida do Egito e recebeu os dez mandamentos", 3, 1, "horizontal"),
                new("ester", 5, "ESTER", "Rainha corajosa que arriscou a vida para salvar seu povo", 2, 6, "vertical")
            ]),
        new(
            "at-medio-1",
            "medio",
            "AT",
            7,
            [
                // ABRAAO(3,1)h intersects BOAZ(3,2)v at B, RUTE(3,3)v at R, ISAQUE(1,4)v at A(3,4), SARA(2,5)v at A(3,5)
                new("abraao", 1, "ABRAAO", "Pai da fe, deixou sua terra a pedido de Deus e recebeu a promessa", 3, 1, "horizontal"),
                new("boaz", 2, "BOAZ", "Parente de Noemi que se casou com Rute por amor e fidelidade", 3, 2, "vertical"),
                new("rute", 3, "RUTE", "Moabita fiel que nao abandonou a sogra Noemi", 3, 3, "vertical"),
                new("isaque", 4, "ISAQUE", "Filho prometido de Abraao, quase sacrificado no monte Moria", 1, 4, "vertical"),
                new("sara", 5, "SARA", "Esposa de Abraao que deu a luz Isaque na velhice", 2, 5, "vertical")
            ])
    ];
    private readonly Dictionary<string, List<string>> _vofSessions = new();
    private readonly object _vofSessionsLock = new();
    private readonly Dictionary<string, ForcaSession> _forcaSessions = new();
    private readonly object _forcaSessionsLock = new();
    private readonly Dictionary<string, CruzadinhaPuzzle> _cruzadinhaSessions = new();
    private readonly object _cruzadinhaSessionsLock = new();

    public PerguntaService(IWebHostEnvironment env)
    {
        var filePath = Path.Combine(env.ContentRootPath, "Data", "banco_biblico_completo.json");
        var json = File.ReadAllText(filePath);
        _perguntas = JsonSerializer.Deserialize<List<Pergunta>>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }) ?? [];
    }

    public List<PerguntaMaratonaSala> GetParaMaratona(TipoModoMaratona tipo, int quantidade, string? dificuldade, string? testamento) =>
        tipo switch
        {
            TipoModoMaratona.Quiz => GetPerguntasFiltradas(dificuldade, testamento, null)
                .OrderBy(_ => Guid.NewGuid()).Take(quantidade)
                .Select(p => new PerguntaMaratonaSala
                {
                    Id = p.Id, Texto = p.Texto, Resposta = p.Resposta,
                    Referencia = p.Referencia, Dificuldade = p.Dificuldade,
                    Alternativas = p.Alternativas.OrderBy(_ => Guid.NewGuid()).ToList()
                }).ToList(),

            TipoModoMaratona.VerdadeiroOuFalso => GetPerguntasFiltradas(dificuldade, testamento, null)
                .Where(p => p.Alternativas.Any(a => !SameAnswer(a, p.Resposta)))
                .OrderBy(_ => Guid.NewGuid()).Take(quantidade)
                .Select(p =>
                {
                    var isTrue = Random.Shared.Next(2) == 0;
                    var answer = isTrue ? p.Resposta : PickWrongAlternative(p);
                    return new PerguntaMaratonaSala
                    {
                        Id = p.Id,
                        Texto = $"{RemoveQuestionMark(p.Texto)} → {answer} — Verdadeiro ou Falso?",
                        Resposta = isTrue ? "verdadeiro" : "falso",
                        Referencia = p.Referencia, Dificuldade = p.Dificuldade,
                        Alternativas = ["Verdadeiro", "Falso"]
                    };
                }).ToList(),

            TipoModoMaratona.Forca => GetPerguntasFiltradas(dificuldade, testamento, personagem: true)
                .OrderBy(_ => Guid.NewGuid()).Take(quantidade)
                .Select(p => new PerguntaMaratonaSala
                {
                    Id = p.Id, Texto = BuildForcaHint(p), Resposta = p.Resposta,
                    Referencia = p.Referencia, Dificuldade = p.Dificuldade, Alternativas = []
                }).ToList(),

            TipoModoMaratona.QuemSouEu => GetPerguntasFiltradas(dificuldade, testamento, personagem: true)
                .OrderBy(_ => Guid.NewGuid()).Take(quantidade)
                .Select(p => new PerguntaMaratonaSala
                {
                    Id = p.Id, Texto = p.Resposta, Resposta = p.Resposta,
                    Referencia = p.Referencia, Dificuldade = p.Dificuldade, Alternativas = []
                }).ToList(),

            _ => []
        };

    public static List<string> ComputarMascaraForca(string resposta, IReadOnlyCollection<string> letrasReveladas)
    {
        var normalized = NormalizarTextoForca(resposta);
        var result = new List<string>();
        for (var i = 0; i < resposta.Length; i++)
        {
            var original = resposta[i];
            if (!char.IsLetter(original)) { result.Add(original == ' ' ? " " : original.ToString()); continue; }
            var normChar = i < normalized.Length ? normalized[i].ToString() : "_";
            result.Add(letrasReveladas.Contains(normChar) ? original.ToString() : "_");
        }
        return result;
    }

    public static string NormalizarTextoForca(string value)
    {
        var normalized = value.Trim().Normalize(System.Text.NormalizationForm.FormD);
        var chars = normalized
            .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c)
                        != System.Globalization.UnicodeCategory.NonSpacingMark)
            .Select(char.ToUpperInvariant);
        return new string(chars.ToArray()).Normalize(System.Text.NormalizationForm.FormC);
    }

    public List<PerguntaEquipesSala> GetAleatorioParaHub(int quantidade, string? dificuldade, string? testamento)
    {
        return GetPerguntasFiltradas(dificuldade, testamento, null)
            .OrderBy(_ => Guid.NewGuid())
            .Take(quantidade)
            .Select(p => new PerguntaEquipesSala
            {
                Id = p.Id,
                Texto = p.Texto,
                Resposta = p.Resposta,
                Referencia = p.Referencia,
                Dificuldade = p.Dificuldade,
                Alternativas = p.Alternativas.OrderBy(_ => Guid.NewGuid()).ToList()
            })
            .ToList();
    }

    public List<PerguntaPublicaDto> GetAleatorio(
        int quantidade,
        string? dificuldade,
        string? testamento,
        bool? personagem = null)
    {
        var query = GetPerguntasFiltradas(dificuldade, testamento, personagem);

        return query
            .OrderBy(_ => Guid.NewGuid())
            .Take(quantidade)
            .Select(p => new PerguntaPublicaDto(p.Id, p.Texto, p.Referencia, p.Testamento, p.Dificuldade, p.Alternativas))
            .ToList();
    }

    public List<VofPerguntaPublicaDto> GetVerdadeiroOuFalso(
        int quantidade,
        string? dificuldade,
        string? testamento,
        bool? personagem = null)
    {
        var perguntas = GetPerguntasFiltradas(dificuldade, testamento, personagem)
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

    public List<ForcaPerguntaPublicaDto> GetForca(int quantidade, string? dificuldade, string? testamento)
    {
        var selecionados = GetPerguntasFiltradas(dificuldade, testamento, personagem: true)
            .OrderBy(_ => Guid.NewGuid())
            .Take(quantidade)
            .Select(p => new ForcaDesafio(
                p.Id,
                p.Resposta,
                BuildForcaHint(p),
                p.Dificuldade,
                p.Testamento,
                p.Referencia))
            .ToList();

        var sessaoId = Guid.NewGuid().ToString("N");
        lock (_forcaSessionsLock)
        {
            _forcaSessions[sessaoId] = new ForcaSession(
                selecionados,
                selecionados.Select(_ => new HashSet<char>()).ToList());
        }

        return selecionados
            .Select((desafio, index) => new ForcaPerguntaPublicaDto(
                sessaoId,
                index,
                desafio.Id,
                desafio.Dica,
                MaskAnswer(desafio.Resposta, []),
                desafio.Dificuldade,
                desafio.Testamento))
            .ToList();
    }

    public ForcaLetraResponse? VerificarLetraForca(string sessaoId, int indice, string letra)
    {
        ForcaDesafio desafio;
        HashSet<char> letrasReveladas;
        lock (_forcaSessionsLock)
        {
            if (!_forcaSessions.TryGetValue(sessaoId, out var sessao) || indice < 0 || indice >= sessao.Desafios.Count)
                return null;

            desafio = sessao.Desafios[indice];
            letrasReveladas = sessao.LetrasReveladas[indice];
        }

        var normalizedLetter = NormalizeForcaText(letra).FirstOrDefault();
        if (normalizedLetter == default) return null;

        var acertou = NormalizeForcaText(desafio.Resposta).Contains(normalizedLetter);
        if (acertou)
            letrasReveladas.Add(normalizedLetter);

        var mascara = MaskAnswer(desafio.Resposta, letrasReveladas);
        var finalizada = !mascara.Contains("_");

        return new ForcaLetraResponse(
            acertou,
            mascara,
            finalizada,
            finalizada ? desafio.Resposta : null);
    }

    public ForcaChuteResponse? ChutarForca(string sessaoId, int indice, string resposta)
    {
        var desafio = GetForcaDesafio(sessaoId, indice);
        if (desafio is null) return null;

        var correta = NormalizeForcaText(desafio.Resposta) == NormalizeForcaText(resposta);
        return new ForcaChuteResponse(correta, desafio.Resposta, correta);
    }

    public CruzadinhaPublicaDto? GetCruzadinha(int quantidade, string? dificuldade, string? testamento)
    {
        var query = _cruzadinhas.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(dificuldade))
            query = query.Where(p => p.Dificuldade.Equals(dificuldade, StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrWhiteSpace(testamento))
            query = query.Where(p => p.Testamento.Equals(testamento, StringComparison.OrdinalIgnoreCase));

        var puzzle = query.OrderBy(_ => Guid.NewGuid()).FirstOrDefault();
        if (puzzle is null) return null;

        var sessaoId = Guid.NewGuid().ToString("N");
        var palavras = puzzle.Palavras
            .OrderBy(p => p.Numero)
            .Take(Math.Clamp(quantidade, 1, puzzle.Palavras.Count))
            .ToList();
        var sessionPuzzle = puzzle with { Palavras = palavras };

        lock (_cruzadinhaSessionsLock)
        {
            _cruzadinhaSessions[sessaoId] = sessionPuzzle;
        }

        return new CruzadinhaPublicaDto(
            sessaoId,
            puzzle.Tamanho,
            palavras
                .Select(p => new CruzadinhaPalavraPublicaDto(
                    p.Id,
                    p.Numero,
                    p.Dica,
                    p.Linha,
                    p.Coluna,
                    p.Direcao,
                    p.Resposta.Length))
                .ToList());
    }

    public CruzadinhaVerificarResponse? VerificarCruzadinha(
        string sessaoId,
        List<CruzadinhaRespostaRequest> respostas)
    {
        CruzadinhaPuzzle puzzle;
        lock (_cruzadinhaSessionsLock)
        {
            if (!_cruzadinhaSessions.TryGetValue(sessaoId, out var sessionPuzzle))
                return null;

            puzzle = sessionPuzzle;
        }

        var respostasPorId = respostas.ToDictionary(r => r.Id, r => r.Resposta);
        var corretas = new List<string>();
        var erradas = new List<string>();

        foreach (var palavra in puzzle.Palavras)
        {
            respostasPorId.TryGetValue(palavra.Id, out var resposta);
            if (NormalizeForcaText(palavra.Resposta) == NormalizeForcaText(resposta ?? ""))
                corretas.Add(palavra.Id);
            else
                erradas.Add(palavra.Id);
        }

        return new CruzadinhaVerificarResponse(corretas, erradas, erradas.Count == 0);
    }

    private IEnumerable<Pergunta> GetPerguntasFiltradas(
        string? dificuldade,
        string? testamento,
        bool? personagem = null)
    {
        var query = _perguntas.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(dificuldade))
            query = query.Where(p => p.Dificuldade.Equals(dificuldade, StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrWhiteSpace(testamento))
            query = query.Where(p => p.Testamento.Equals(testamento, StringComparison.OrdinalIgnoreCase));

        if (personagem is not null)
            query = query.Where(p => p.Personagem == personagem);

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

    private static string RemoveReferenceHint(string text)
    {
        var trimmed = text.Trim();
        var openIndex = trimmed.LastIndexOf('(');
        var closeIndex = trimmed.LastIndexOf(')');

        if (openIndex >= 0 && closeIndex == trimmed.Length - 1 && closeIndex > openIndex)
            return trimmed[..openIndex].Trim().TrimEnd('?', '.', ' ', '\t', '\r', '\n');

        return RemoveQuestionMark(trimmed);
    }

    private static string BuildForcaHint(Pergunta pergunta)
    {
        var hint = RemoveReferenceHint(pergunta.Texto);
        hint = RemoveAnswerFromHint(hint, pergunta.Resposta);

        if (LooksLikeAnswerQuestion(hint) || hint.Length < 12)
            hint = BuildGenericForcaHint(pergunta);

        return hint;
    }

    private static string BuildGenericForcaHint(Pergunta pergunta)
    {
        if (!string.IsNullOrWhiteSpace(pergunta.Referencia))
            return $"Personagem biblico citado em {pergunta.Referencia}";

        return pergunta.Testamento.Equals("AT", StringComparison.OrdinalIgnoreCase)
            ? "Personagem biblico do Antigo Testamento"
            : "Personagem biblico do Novo Testamento";
    }

    private static bool LooksLikeAnswerQuestion(string hint)
    {
        var normalized = NormalizeForcaText(hint).ToLowerInvariant();
        var prefixes = new[]
        {
            "quem ",
            "que personagem",
            "qual personagem",
            "nome de quem",
            "o nome de quem",
            "personagem que"
        };

        return prefixes.Any(prefix => normalized.StartsWith(prefix));
    }

    private static string RemoveAnswerFromHint(string hint, string answer)
    {
        var result = hint;
        foreach (var part in answer.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (part.Length < 3) continue;
            result = System.Text.RegularExpressions.Regex.Replace(
                result,
                $@"\b{System.Text.RegularExpressions.Regex.Escape(part)}\b",
                "_____",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        }

        return result.Trim();
    }

    private static bool SameAnswer(string left, string right)
    {
        return NormalizeAnswer(left).Equals(NormalizeAnswer(right), StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizeAnswer(string value)
    {
        return string.Join(' ', value.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private ForcaDesafio? GetForcaDesafio(string sessaoId, int indice)
    {
        lock (_forcaSessionsLock)
        {
            if (!_forcaSessions.TryGetValue(sessaoId, out var sessao) || indice < 0 || indice >= sessao.Desafios.Count)
                return null;

            return sessao.Desafios[indice];
        }
    }

    private static List<string> MaskAnswer(string answer, IReadOnlyCollection<char> revealedLetters)
    {
        var normalized = NormalizeForcaText(answer);
        var result = new List<string>();
        for (var i = 0; i < answer.Length; i++)
        {
            var original = answer[i];
            if (!char.IsLetter(original)) { result.Add(original == ' ' ? " " : original.ToString()); continue; }
            var normalizedChar = normalized.ElementAtOrDefault(i);
            result.Add(revealedLetters.Contains(normalizedChar) ? original.ToString() : "_");
        }
        return result;
    }

    private static string NormalizeForcaText(string value) => NormalizarTextoForca(value);

    private record ForcaDesafio(
        string Id,
        string Resposta,
        string Dica,
        string Dificuldade,
        string Testamento,
        string Referencia);

    private record ForcaSession(
        List<ForcaDesafio> Desafios,
        List<HashSet<char>> LetrasReveladas);

    private record CruzadinhaPuzzle(
        string Id,
        string Dificuldade,
        string Testamento,
        int Tamanho,
        List<CruzadinhaPalavra> Palavras);

    private record CruzadinhaPalavra(
        string Id,
        int Numero,
        string Resposta,
        string Dica,
        int Linha,
        int Coluna,
        string Direcao);
}
