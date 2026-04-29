import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PerguntaService } from '../../services/pergunta.service';
import { ForcaPerguntaPublica } from '../../models/pergunta.model';
import { GameRule, RulesScreen } from '../../shared/rules-screen/rules-screen';
import { ReportIssue } from '../../shared/report-issue/report-issue';

type GamePhase = 'rules' | 'config' | 'transition' | 'playing' | 'result';

interface Team {
  name: string;
  score: number;
}

interface ForcaRecord {
  team: string;
  dica: string;
  respostaCorreta: string;
  resultado: string;
  pontos: number;
}

@Component({
  selector: 'app-forca',
  imports: [CommonModule, FormsModule, RouterLink, RulesScreen, ReportIssue],
  templateUrl: './forca.html',
  styleUrl: './forca.scss'
})
export class Forca {
  phase: GamePhase = 'rules';

  readonly rules: GameRule[] = [
    { icon: 'ABC', text: 'As equipes disputam para descobrir um personagem biblico' },
    { icon: '?', text: 'Uma dica aparece na tela e o nome fica escondido em campos' },
    { icon: '+', text: 'Na sua vez, escolha uma letra ou tente chutar o nome completo' },
    { icon: '1x', text: 'A equipe so pode fazer um chute por vez' },
    { icon: 'PTS', text: 'Letras certas pontuam, mas acertar o personagem vence a rodada' }
  ];

  teamCount = 2;
  teams: Team[] = [
    { name: 'Equipe 1', score: 0 },
    { name: 'Equipe 2', score: 0 }
  ];
  dificuldade = '';
  testamento = '';
  questionsPerGame = 5;

  questions: ForcaPerguntaPublica[] = [];
  currentIndex = signal(0);
  currentTeamIndex = signal(0);
  usedLetters: string[] = [];
  wrongLetters: string[] = [];
  guess = '';
  guessing = false;
  waitingResponse = false;
  feedback: { type: 'ok' | 'err'; message: string } | null = null;
  records: ForcaRecord[] = [];
  loading = false;
  error = '';

  readonly alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  readonly currentQuestion = computed(() => this.questions[this.currentIndex()] ?? null);
  readonly currentTeam = computed(() => this.teams[this.currentTeamIndex()] ?? this.teams[0]);
  readonly ranking = computed(() =>
    [...this.teams].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  );
  readonly winners = computed(() => {
    const bestScore = Math.max(...this.teams.map(team => team.score));
    return this.teams.filter(team => team.score === bestScore);
  });

  constructor(private perguntaService: PerguntaService) {}

  goToConfig() {
    this.phase = 'config';
  }

  updateTeamCount() {
    const nextTeams: Team[] = [];
    for (let index = 0; index < this.teamCount; index++) {
      nextTeams.push(this.teams[index] ?? { name: `Equipe ${index + 1}`, score: 0 });
    }
    this.teams = nextTeams;
  }

  startGame() {
    this.loading = true;
    this.error = '';
    this.perguntaService
      .getForca(this.questionsPerGame, this.dificuldade || undefined, this.testamento || undefined)
      .subscribe({
        next: questions => {
          if (questions.length === 0) {
            this.error = 'Nenhum desafio de forca encontrado com os filtros selecionados.';
            this.loading = false;
            return;
          }

          this.teams = this.teams.map((team, index) => ({
            name: team.name.trim() || `Equipe ${index + 1}`,
            score: 0
          }));
          this.questions = questions;
          this.records = [];
          this.currentIndex.set(0);
          this.currentTeamIndex.set(Math.floor(Math.random() * this.teams.length));
          this.loading = false;
          this.prepareRound();
        },
        error: () => {
          this.error = 'Erro ao carregar desafios. Verifique se o backend esta rodando em http://localhost:5000.';
          this.loading = false;
        }
      });
  }

  readyForTurn() {
    this.phase = 'playing';
  }

  chooseLetter(letter: string) {
    const current = this.currentQuestion();
    if (!current || this.waitingResponse || this.isLetterUsed(letter)) return;

    this.waitingResponse = true;
    this.usedLetters.push(letter);

    this.perguntaService.verificarLetraForca(current.sessaoId, current.indice, letter).subscribe({
      next: result => {
        current.mascara = result.mascara;

        if (result.acertou) {
          this.currentTeam().score += 1;
          this.feedback = {
            type: 'ok',
            message: `Letra certa! +1 ponto para ${this.currentTeam().name}.`
          };
          if (result.finalizada) {
            this.finishRound(result.respostaCorreta ?? current.mascara.join(''), 'completou o personagem', 3);
            return;
          }
        } else {
          this.wrongLetters.push(letter);
          this.feedback = { type: 'err', message: `Nao tem ${letter}. A vez passou.` };
          this.passTurn();
        }

        this.waitingResponse = false;
      },
      error: () => {
        this.feedback = { type: 'err', message: 'Nao foi possivel validar a letra.' };
        this.waitingResponse = false;
      }
    });
  }

  openGuess() {
    if (this.waitingResponse) return;
    this.guess = '';
    this.guessing = true;
  }

  cancelGuess() {
    this.guessing = false;
    this.guess = '';
  }

  submitGuess() {
    const current = this.currentQuestion();
    const answer = this.guess.trim();
    if (!current || !answer || this.waitingResponse) return;

    this.waitingResponse = true;
    this.perguntaService.chutarForca(current.sessaoId, current.indice, answer).subscribe({
      next: result => {
        this.guessing = false;
        if (result.correta) {
          this.finishRound(result.respostaCorreta, 'acertou no chute', 5);
          return;
        }

        this.records.push({
          team: this.currentTeam().name,
          dica: current.dica,
          respostaCorreta: result.respostaCorreta,
          resultado: 'chute errado',
          pontos: 0
        });
        this.feedback = { type: 'err', message: 'Chute errado. A vez passou.' };
        this.passTurn();
        this.waitingResponse = false;
      },
      error: () => {
        this.feedback = { type: 'err', message: 'Nao foi possivel validar o chute.' };
        this.waitingResponse = false;
      }
    });
  }

  playAgain() {
    this.startGame();
  }

  newGame() {
    this.phase = 'config';
    this.questions = [];
    this.records = [];
    this.feedback = null;
  }

  isLetterUsed(letter: string): boolean {
    return this.usedLetters.includes(letter);
  }

  private prepareRound() {
    this.usedLetters = [];
    this.wrongLetters = [];
    this.guess = '';
    this.guessing = false;
    this.waitingResponse = false;
    this.feedback = null;
    this.phase = 'transition';
  }

  private finishRound(answer: string, result: string, bonus: number) {
    const current = this.currentQuestion();
    if (!current) return;

    this.currentTeam().score += bonus;
    this.records.push({
      team: this.currentTeam().name,
      dica: current.dica,
      respostaCorreta: answer,
      resultado: result,
      pontos: bonus
    });
    this.feedback = {
      type: 'ok',
      message: `${this.currentTeam().name} venceu a rodada! Resposta: ${answer}.`
    };
    this.waitingResponse = true;
    setTimeout(() => this.nextRound(), 1800);
  }

  private nextRound() {
    if (this.currentIndex() < this.questions.length - 1) {
      this.currentIndex.update(index => index + 1);
      this.passTurn();
      this.prepareRound();
      return;
    }

    this.phase = 'result';
  }

  private passTurn() {
    this.currentTeamIndex.update(index => (index + 1) % this.teams.length);
  }
}
