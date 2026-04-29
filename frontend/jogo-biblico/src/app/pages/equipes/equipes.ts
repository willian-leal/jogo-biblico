import { Component, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PerguntaService } from '../../services/pergunta.service';
import { PerguntaPublica } from '../../models/pergunta.model';
import { RulesScreen, GameRule } from '../../shared/rules-screen/rules-screen';
import { ReportIssue } from '../../shared/report-issue/report-issue';

type GamePhase = 'rules' | 'config' | 'transition' | 'playing' | 'result';

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
  pontos: number;
}

@Component({
  selector: 'app-equipes',
  imports: [CommonModule, FormsModule, RouterLink, RulesScreen, ReportIssue],
  templateUrl: './equipes.html',
  styleUrl: './equipes.scss'
})
export class Equipes implements OnDestroy {
  phase: GamePhase = 'rules';

  readonly rules: GameRule[] = [
    { icon: '👥', text: 'As equipes se alternam, uma pergunta por vez' },
    { icon: '📱', text: 'Passe o dispositivo para cada equipe antes da pergunta aparecer' },
    { icon: '🏆', text: 'Pontuação base: Fácil 1pt · Médio 2pts · Difícil 3pts' },
    { icon: '⚡', text: 'Bônus de velocidade: +1pt se restar mais de 20 segundos' },
    { icon: '⏱', text: 'Cada uso de +10s custa −1pt na pergunta (mínimo 0)' }
  ];

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
  feedback: { correta: boolean; respostaCorreta: string } | null = null;
  addTimeUses = 0;
  pontosGanhos = 0;
  records: TeamRecord[] = [];
  loading = false;
  error = '';

  private timerInterval?: ReturnType<typeof setInterval>;

  readonly currentQuestion = computed(() => this.questions[this.currentIndex()] ?? null);
  readonly currentTeamIndex = computed(() => this.currentIndex() % this.teams.length);
  readonly currentTeam = computed(() => this.teams[this.currentTeamIndex()] ?? this.teams[0]);
  readonly totalQuestions = computed(() => this.teamCount * this.questionsPerTeam);
  readonly timerPercent = computed(() => Math.min(100, (this.timerSeconds() / 30) * 100));
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
          this.loading = false;
          this.prepareNextTurn();
        },
        error: () => {
          this.error = 'Erro ao carregar perguntas. Verifique se o backend está rodando em http://localhost:5000.';
          this.loading = false;
        }
      });
  }

  readyForTurn() {
    this.phase = 'playing';
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timerSeconds.update(seconds => seconds - 1);
      if (this.timerSeconds() <= 0) {
        clearInterval(this.timerInterval);
        this.submitAnswer('');
      }
    }, 1000);
  }

  addTime() {
    if (!this.waitingFeedback) {
      this.timerSeconds.update(seconds => seconds + 10);
      this.addTimeUses++;
    }
  }

  chooseAnswer(answer: string) {
    if (this.waitingFeedback) return;
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

  private prepareNextTurn() {
    this.phase = 'transition';
    this.timerSeconds.set(30);
    this.selectedAnswer = '';
    this.waitingFeedback = false;
    this.feedback = null;
    this.addTimeUses = 0;
    this.pontosGanhos = 0;
    clearInterval(this.timerInterval);
  }

  private submitAnswer(answer: string) {
    const current = this.currentQuestion();
    if (!current || this.waitingFeedback) return;
    this.waitingFeedback = true;

    this.perguntaService.verificarResposta(current.id, answer).subscribe({
      next: result => {
        this.feedback = result;
        if (result.correta) {
          const score = this.calcScore(current.dificuldade, this.timerSeconds(), this.addTimeUses);
          this.pontosGanhos = score;
          this.currentTeam().score += score;
        } else {
          this.pontosGanhos = 0;
        }
        this.records.push({
          team: this.currentTeam().name,
          pergunta: current.pergunta,
          respostaDada: answer || '(sem resposta)',
          respostaCorreta: result.respostaCorreta,
          correta: result.correta,
          pontos: this.pontosGanhos
        });
        setTimeout(() => this.nextTurn(), 2000);
      },
      error: () => this.nextTurn()
    });
  }

  private nextTurn() {
    if (this.currentIndex() < this.questions.length - 1) {
      this.currentIndex.update(index => index + 1);
      this.prepareNextTurn();
      return;
    }
    clearInterval(this.timerInterval);
    this.phase = 'result';
  }

  // base por dificuldade + bônus de velocidade (>20s) − penalidade de +10s
  private calcScore(dificuldade: string, timeRemaining: number, addTimeUses: number): number {
    const base = dificuldade === 'facil' ? 1 : dificuldade === 'medio' ? 2 : 3;
    const speedBonus = timeRemaining > 20 ? 1 : 0;
    return Math.max(0, base + speedBonus - addTimeUses);
  }

  private shuffle<T>(items: T[]): T[] {
    return [...items].sort(() => Math.random() - 0.5);
  }

  ngOnDestroy() {
    clearInterval(this.timerInterval);
  }
}
