import { Component, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PerguntaService } from '../../services/pergunta.service';
import { PerguntaPublica } from '../../models/pergunta.model';

type GamePhase = 'config' | 'playing' | 'result';

interface Team {
  name: string;
  score: number;
}

interface TeamRecord {
  team: string;
  pergunta: string;
  respostaDada: string;
  respostaCorreta: string;
  correta: boolean;
}

@Component({
  selector: 'app-equipes',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './equipes.html',
  styleUrl: './equipes.scss'
})
export class Equipes implements OnDestroy {
  phase: GamePhase = 'config';

  teamCount = 2;
  teams: Team[] = [
    { name: 'Equipe 1', score: 0 },
    { name: 'Equipe 2', score: 0 }
  ];
  dificuldade = '';
  testamento = '';
  questionsPerTeam = 5;

  questions: PerguntaPublica[] = [];
  currentIndex = signal(0);
  timerSeconds = signal(30);
  selectedAnswer = '';
  waitingFeedback = false;
  alternativesVisible = false;
  feedback: { correta: boolean; respostaCorreta: string } | null = null;
  records: TeamRecord[] = [];
  loading = false;
  error = '';

  private timerInterval?: ReturnType<typeof setInterval>;

  readonly currentQuestion = computed(() => this.questions[this.currentIndex()] ?? null);
  readonly currentTeamIndex = computed(() => this.currentIndex() % this.teams.length);
  readonly currentTeam = computed(() => this.teams[this.currentTeamIndex()] ?? this.teams[0]);
  readonly totalQuestions = computed(() => this.teamCount * this.questionsPerTeam);
  readonly timerPercent = computed(() => (this.timerSeconds() / 30) * 100);
  readonly ranking = computed(() =>
    [...this.teams].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  );
  readonly winners = computed(() => {
    const bestScore = Math.max(...this.teams.map(team => team.score));
    return this.teams.filter(team => team.score === bestScore);
  });

  constructor(private perguntaService: PerguntaService) {}

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
    const amount = this.totalQuestions();

    this.perguntaService
      .getPerguntas(amount, this.dificuldade || undefined, this.testamento || undefined)
      .subscribe({
        next: questions => {
          if (questions.length === 0) {
            this.error = 'Nenhuma pergunta encontrada com os filtros selecionados.';
            this.loading = false;
            return;
          }

          this.teams = this.teams.map((team, index) => ({
            name: team.name.trim() || `Equipe ${index + 1}`,
            score: 0
          }));
          this.questions = questions.map(question => ({
            ...question,
            alternativas: this.shuffle(question.alternativas)
          }));
          this.currentIndex.set(0);
          this.records = [];
          this.phase = 'playing';
          this.loading = false;
          this.startTurn();
        },
        error: () => {
          this.error = 'Erro ao carregar perguntas. Verifique se o backend está rodando em http://localhost:5000.';
          this.loading = false;
        }
      });
  }

  showAlternatives() {
    if (this.waitingFeedback) return;
    this.alternativesVisible = true;
  }

  addTime() {
    if (!this.waitingFeedback) this.timerSeconds.update(seconds => seconds + 10);
  }

  chooseAnswer(answer: string) {
    if (this.waitingFeedback || !this.alternativesVisible) return;
    this.selectedAnswer = answer;
    clearInterval(this.timerInterval);
    this.submitAnswer(answer);
  }

  playAgain() {
    this.startGame();
  }

  newGame() {
    clearInterval(this.timerInterval);
    this.phase = 'config';
    this.questions = [];
    this.records = [];
  }

  getAlternativeClass(alternative: string): string {
    if (!this.feedback) return alternative === this.selectedAnswer ? 'selected' : '';
    if (alternative === this.feedback.respostaCorreta) return 'correct';
    if (alternative === this.selectedAnswer && !this.feedback.correta) return 'wrong';
    return '';
  }

  private startTurn() {
    this.timerSeconds.set(30);
    this.selectedAnswer = '';
    this.waitingFeedback = false;
    this.alternativesVisible = false;
    this.feedback = null;
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timerSeconds.update(seconds => seconds - 1);
      if (this.timerSeconds() <= 0) {
        clearInterval(this.timerInterval);
        this.submitAnswer('');
      }
    }, 1000);
  }

  private submitAnswer(answer: string) {
    const current = this.currentQuestion();
    if (!current || this.waitingFeedback) return;
    this.waitingFeedback = true;
    this.alternativesVisible = true;

    this.perguntaService.verificarResposta(current.id, answer).subscribe({
      next: result => {
        this.feedback = result;
        if (result.correta) {
          this.currentTeam().score += 1;
        }
        this.records.push({
          team: this.currentTeam().name,
          pergunta: current.pergunta,
          respostaDada: answer || '(sem resposta)',
          respostaCorreta: result.respostaCorreta,
          correta: result.correta
        });
        setTimeout(() => this.nextTurn(), 2000);
      },
      error: () => this.nextTurn()
    });
  }

  private nextTurn() {
    if (this.currentIndex() < this.questions.length - 1) {
      this.currentIndex.update(index => index + 1);
      this.startTurn();
      return;
    }

    clearInterval(this.timerInterval);
    this.phase = 'result';
  }

  private shuffle<T>(items: T[]): T[] {
    return [...items].sort(() => Math.random() - 0.5);
  }

  ngOnDestroy() {
    clearInterval(this.timerInterval);
  }
}
