using JogoBiblicoBackend.Data;
using JogoBiblicoBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace JogoBiblicoBackend.Services;

public class AuthService
{
    private readonly AppDbContext _db;
    private readonly TokenService _tokenService;

    public AuthService(AppDbContext db, TokenService tokenService)
    {
        _db = db;
        _tokenService = tokenService;
    }

    public async Task<AuthResponse?> RegisterAsync(RegisterRequest req)
    {
        var exists = await _db.Users.AnyAsync(u => u.Email == req.Email);
        if (exists) return null;

        var user = new User
        {
            Name = req.Name,
            Email = req.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password)
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var token = _tokenService.GerarToken(user);
        return new AuthResponse(token, user.Name, user.Email, user.IsAdmin);
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest req)
    {
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Email == req.Email);

        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return null;

        var token = _tokenService.GerarToken(user);
        return new AuthResponse(token, user.Name, user.Email, user.IsAdmin);
    }
}
