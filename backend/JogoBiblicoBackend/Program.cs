using System.Security.Claims;
using System.Text;
using System.Text.Json;
using JogoBiblicoBackend.Data;
using JogoBiblicoBackend.Hubs;
using JogoBiblicoBackend.Models;
using JogoBiblicoBackend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Banco de dados SQLite
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// Serviços
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddSingleton<PerguntaService>();
builder.Services.AddSingleton<SalaService>();
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
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

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

app.MapPost("/perguntas/relatar-problema", async (RelatarProblemaRequest req, IWebHostEnvironment env) =>
{
    if (string.IsNullOrWhiteSpace(req.Modo) || string.IsNullOrWhiteSpace(req.Motivo))
        return Results.BadRequest();

    var relato = new
    {
        id = Guid.NewGuid().ToString("N"),
        criadoEm = DateTimeOffset.UtcNow,
        modo = req.Modo.Trim(),
        perguntaId = req.PerguntaId?.Trim(),
        contexto = req.Contexto?.Trim(),
        motivo = req.Motivo.Trim(),
        detalhe = req.Detalhe?.Trim()
    };

    var dataPath = Path.Combine(env.ContentRootPath, "Data");
    Directory.CreateDirectory(dataPath);
    var filePath = Path.Combine(dataPath, "relatos_problemas.jsonl");
    var line = JsonSerializer.Serialize(relato) + Environment.NewLine;
    await File.AppendAllTextAsync(filePath, line);

    return Results.Ok();
});

app.MapHub<ForcaHub>("/hubs/forca");

app.Run();
