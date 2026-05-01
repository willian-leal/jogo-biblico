using System.Security.Claims;
using System.Text;
using System.Text.Json;
using JogoBiblicoBackend.Data;
using JogoBiblicoBackend.Hubs;
using JogoBiblicoBackend.Models;
using JogoBiblicoBackend.Services;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

var renderPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(renderPort))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{renderPort}");
}

// Banco de dados SQLite
var defaultConnection = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=jogo_biblico.db";
EnsureSqliteDirectory(defaultConnection);
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite(defaultConnection));

// Serviços
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddSingleton<PerguntaService>();
builder.Services.AddSingleton<SalaService>();
builder.Services.AddSingleton<SalaEquipesService>();
builder.Services.AddSingleton<SalaMaratonaService>();
builder.Services.AddSignalR();

// JWT
var jwtSecret = builder.Configuration["Jwt:Secret"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));

// CORS — permite qualquer origem para suportar dispositivos na rede local
builder.Services.AddCors(opt =>
    opt.AddDefaultPolicy(p =>
        p.SetIsOriginAllowed(_ => true)
         .AllowAnyHeader()
         .AllowAnyMethod()
         .AllowCredentials()));

var app = builder.Build();

// Auto-migrar banco de dados na inicialização
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    var adminEmail = builder.Configuration["Admin:Email"];
    var adminPassword = builder.Configuration["Admin:Password"];
    var adminName = builder.Configuration["Admin:Name"] ?? "Administrador";
    if (!string.IsNullOrWhiteSpace(adminEmail) && !string.IsNullOrWhiteSpace(adminPassword))
    {
        var seededAdmin = db.Users.FirstOrDefault(u => u.Email == adminEmail);
        if (seededAdmin is null)
        {
            db.Users.Add(new User
            {
                Name = adminName,
                Email = adminEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                IsAdmin = true
            });
            db.SaveChanges();
        }
        else if (!seededAdmin.IsAdmin)
        {
            seededAdmin.IsAdmin = true;
            db.SaveChanges();
        }
    }
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// Auth endpoints
app.MapPost("/auth/register", async (RegisterRequest req, AuthService auth) =>
{
    var result = await auth.RegisterAsync(req);
    return result is null
        ? Results.Conflict("Email already registered")
        : Results.Ok(result);
});

app.MapPost("/auth/login", async (LoginRequest req, AuthService auth) =>
{
    var result = await auth.LoginAsync(req);
    return result is null
        ? Results.Unauthorized()
        : Results.Ok(result);
});

app.MapGet("/me", (ClaimsPrincipal user) =>
{
    var email = user.FindFirst(ClaimTypes.Email)?.Value;
    var name = user.FindFirst(ClaimTypes.Name)?.Value;
    return Results.Ok(new { email, name });
}).RequireAuthorization();

// Perguntas endpoints (públicos no MVP)
app.MapGet("/perguntas/aleatorio", (
    int? quantidade,
    string? dificuldade,
    string? testamento,
    bool? personagem,
    PerguntaService perguntaService) =>
{
    var perguntas = perguntaService.GetAleatorio(quantidade ?? 10, dificuldade, testamento, personagem);
    return Results.Ok(perguntas);
});

app.MapPost("/perguntas/verificar", (VerificarRequest req, PerguntaService perguntaService) =>
{
    var resultado = perguntaService.VerificarResposta(req.Id, req.Resposta);
    return resultado is null
        ? Results.NotFound()
        : Results.Ok(resultado);
});

app.MapGet("/perguntas/vof", (
    int? quantidade,
    string? dificuldade,
    string? testamento,
    bool? personagem,
    PerguntaService perguntaService) =>
{
    var perguntas = perguntaService.GetVerdadeiroOuFalso(quantidade ?? 10, dificuldade, testamento, personagem);
    return Results.Ok(perguntas);
});

app.MapPost("/perguntas/vof/verificar", (VofVerificarRequest req, PerguntaService perguntaService) =>
{
    var resultado = perguntaService.VerificarVerdadeiroOuFalso(req.SessaoId, req.Indice, req.Resposta);
    return resultado is null
        ? Results.NotFound()
        : Results.Ok(resultado);
});

app.MapGet("/perguntas/forca", (
    int? quantidade,
    string? dificuldade,
    string? testamento,
    PerguntaService perguntaService) =>
{
    var perguntas = perguntaService.GetForca(quantidade ?? 5, dificuldade, testamento);
    return Results.Ok(perguntas);
});

app.MapPost("/perguntas/forca/letra", (ForcaLetraRequest req, PerguntaService perguntaService) =>
{
    var resultado = perguntaService.VerificarLetraForca(req.SessaoId, req.Indice, req.Letra);
    return resultado is null
        ? Results.NotFound()
        : Results.Ok(resultado);
});

app.MapPost("/perguntas/forca/chute", (ForcaChuteRequest req, PerguntaService perguntaService) =>
{
    var resultado = perguntaService.ChutarForca(req.SessaoId, req.Indice, req.Resposta);
    return resultado is null
        ? Results.NotFound()
        : Results.Ok(resultado);
});

app.MapGet("/perguntas/cruzadinha", (
    int? quantidade,
    string? dificuldade,
    string? testamento,
    PerguntaService perguntaService) =>
{
    var cruzadinha = perguntaService.GetCruzadinha(quantidade ?? 5, dificuldade, testamento);
    return cruzadinha is null
        ? Results.NotFound()
        : Results.Ok(cruzadinha);
});

app.MapPost("/perguntas/cruzadinha/verificar", (CruzadinhaVerificarRequest req, PerguntaService perguntaService) =>
{
    var resultado = perguntaService.VerificarCruzadinha(req.SessaoId, req.Respostas);
    return resultado is null
        ? Results.NotFound()
        : Results.Ok(resultado);
});

app.MapPost("/perguntas/relatar-problema", async (RelatarProblemaRequest req, AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(req.Modo) || string.IsNullOrWhiteSpace(req.Motivo))
        return Results.BadRequest();

    var report = new QuestionReport
    {
        Modo = req.Modo.Trim(),
        PerguntaId = req.PerguntaId?.Trim(),
        Contexto = req.Contexto?.Trim(),
        Motivo = req.Motivo.Trim(),
        Detalhe = req.Detalhe?.Trim()
    };

    db.QuestionReports.Add(report);
    await db.SaveChangesAsync();

    return Results.Ok();
});

app.MapPost("/perguntas/sugerir", async (QuestionSuggestionRequest req, AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(req.Nome) ||
        string.IsNullOrWhiteSpace(req.Pergunta) ||
        string.IsNullOrWhiteSpace(req.RespostaCorreta))
        return Results.BadRequest();

    var suggestion = new QuestionSuggestion
    {
        Nome = req.Nome.Trim(),
        Contato = req.Contato?.Trim(),
        Pergunta = req.Pergunta.Trim(),
        AlternativaA = req.AlternativaA?.Trim(),
        AlternativaB = req.AlternativaB?.Trim(),
        AlternativaC = req.AlternativaC?.Trim(),
        AlternativaD = req.AlternativaD?.Trim(),
        RespostaCorreta = req.RespostaCorreta.Trim(),
        Referencia = req.Referencia?.Trim(),
        Dificuldade = string.IsNullOrWhiteSpace(req.Dificuldade) ? "medio" : req.Dificuldade.Trim(),
        Testamento = req.Testamento?.Trim() ?? "",
        Observacao = req.Observacao?.Trim()
    };

    db.QuestionSuggestions.Add(suggestion);
    await db.SaveChangesAsync();
    return Results.Ok();
});

var adminGroup = app.MapGroup("/admin").RequireAuthorization("AdminOnly");

adminGroup.MapGet("/reports", async (string? status, AppDbContext db) =>
{
    var query = db.QuestionReports.AsNoTracking();
    if (!string.IsNullOrWhiteSpace(status))
        query = query.Where(r => r.Status == status);

    var reports = await query
        .OrderByDescending(r => r.CreatedAt)
        .Take(300)
        .Select(r => new QuestionReportDto(
            r.Id,
            r.CreatedAt,
            r.Modo,
            r.PerguntaId,
            r.Contexto,
            r.Motivo,
            r.Detalhe,
            r.Status))
        .ToListAsync();

    return Results.Ok(reports);
});

adminGroup.MapPatch("/reports/{id:guid}/status", async (Guid id, UpdateStatusRequest req, AppDbContext db) =>
{
    var report = await db.QuestionReports.FindAsync(id);
    if (report is null) return Results.NotFound();
    report.Status = NormalizeStatus(req.Status, "novo");
    await db.SaveChangesAsync();
    return Results.Ok();
});

adminGroup.MapGet("/suggestions", async (string? status, AppDbContext db) =>
{
    var query = db.QuestionSuggestions.AsNoTracking();
    if (!string.IsNullOrWhiteSpace(status))
        query = query.Where(s => s.Status == status);

    var suggestions = await query
        .OrderByDescending(s => s.CreatedAt)
        .Take(300)
        .Select(s => new QuestionSuggestionDto(
            s.Id,
            s.CreatedAt,
            s.Nome,
            s.Contato,
            s.Pergunta,
            s.AlternativaA,
            s.AlternativaB,
            s.AlternativaC,
            s.AlternativaD,
            s.RespostaCorreta,
            s.Referencia,
            s.Dificuldade,
            s.Testamento,
            s.Observacao,
            s.Status))
        .ToListAsync();

    return Results.Ok(suggestions);
});

adminGroup.MapPatch("/suggestions/{id:guid}/status", async (Guid id, UpdateStatusRequest req, AppDbContext db) =>
{
    var suggestion = await db.QuestionSuggestions.FindAsync(id);
    if (suggestion is null) return Results.NotFound();
    suggestion.Status = NormalizeStatus(req.Status, "nova");
    await db.SaveChangesAsync();
    return Results.Ok();
});

app.MapHub<ForcaHub>("/hubs/forca");
app.MapHub<EquipesHub>("/hubs/equipes");
app.MapHub<MaratonaHub>("/hubs/maratona");

app.Run();

static string NormalizeStatus(string? status, string fallback)
{
    var normalized = status?.Trim().ToLowerInvariant();
    return string.IsNullOrWhiteSpace(normalized) ? fallback : normalized;
}

static void EnsureSqliteDirectory(string connectionString)
{
    var sqlite = new SqliteConnectionStringBuilder(connectionString);
    var dataSource = sqlite.DataSource;
    if (string.IsNullOrWhiteSpace(dataSource) || dataSource.Equals(":memory:", StringComparison.OrdinalIgnoreCase))
        return;

    var directory = Path.GetDirectoryName(Path.GetFullPath(dataSource));
    if (!string.IsNullOrWhiteSpace(directory))
        Directory.CreateDirectory(directory);
}
