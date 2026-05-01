using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JogoBiblicoBackend.Migrations
{
    /// <inheritdoc />
    public partial class AdminReportsSuggestions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsAdmin",
                table: "Users",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "QuestionReports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Modo = table.Column<string>(type: "TEXT", nullable: false),
                    PerguntaId = table.Column<string>(type: "TEXT", nullable: true),
                    Contexto = table.Column<string>(type: "TEXT", nullable: true),
                    Motivo = table.Column<string>(type: "TEXT", nullable: false),
                    Detalhe = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionReports", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "QuestionSuggestions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Nome = table.Column<string>(type: "TEXT", nullable: false),
                    Contato = table.Column<string>(type: "TEXT", nullable: true),
                    Pergunta = table.Column<string>(type: "TEXT", nullable: false),
                    AlternativaA = table.Column<string>(type: "TEXT", nullable: true),
                    AlternativaB = table.Column<string>(type: "TEXT", nullable: true),
                    AlternativaC = table.Column<string>(type: "TEXT", nullable: true),
                    AlternativaD = table.Column<string>(type: "TEXT", nullable: true),
                    RespostaCorreta = table.Column<string>(type: "TEXT", nullable: false),
                    Referencia = table.Column<string>(type: "TEXT", nullable: true),
                    Dificuldade = table.Column<string>(type: "TEXT", nullable: false),
                    Testamento = table.Column<string>(type: "TEXT", nullable: false),
                    Observacao = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionSuggestions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuestionReports_CreatedAt",
                table: "QuestionReports",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionReports_Status",
                table: "QuestionReports",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionSuggestions_CreatedAt",
                table: "QuestionSuggestions",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionSuggestions_Status",
                table: "QuestionSuggestions",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "QuestionReports");
            migrationBuilder.DropTable(name: "QuestionSuggestions");
            migrationBuilder.DropColumn(name: "IsAdmin", table: "Users");
        }
    }
}
