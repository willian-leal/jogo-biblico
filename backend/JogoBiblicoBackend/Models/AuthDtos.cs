namespace JogoBiblicoBackend.Models;

public record RegisterRequest(string Name, string Email, string Password);

public record LoginRequest(string Email, string Password);

public record AuthResponse(string Token, string Name, string Email, bool IsAdmin);

// record é um tipo do C# moderno, imutável por padrão e perfeito para DTOs.
// Os três juntos num arquivo só porque são pequenos e relacionados — mantém o projeto organizado.
