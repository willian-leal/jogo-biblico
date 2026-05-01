using Microsoft.EntityFrameworkCore;
using JogoBiblicoBackend.Models;

namespace JogoBiblicoBackend.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<QuestionReport> QuestionReports { get; set; }
    public DbSet<QuestionSuggestion> QuestionSuggestions { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(u => u.Id);
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.Email).IsRequired();
            entity.Property(u => u.PasswordHash).IsRequired();
        });

        modelBuilder.Entity<QuestionReport>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Modo).IsRequired();
            entity.Property(r => r.Motivo).IsRequired();
            entity.Property(r => r.Status).IsRequired();
            entity.HasIndex(r => r.Status);
            entity.HasIndex(r => r.CreatedAt);
        });

        modelBuilder.Entity<QuestionSuggestion>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.Property(s => s.Nome).IsRequired();
            entity.Property(s => s.Pergunta).IsRequired();
            entity.Property(s => s.RespostaCorreta).IsRequired();
            entity.Property(s => s.Status).IsRequired();
            entity.HasIndex(s => s.Status);
            entity.HasIndex(s => s.CreatedAt);
        });
    }
}
