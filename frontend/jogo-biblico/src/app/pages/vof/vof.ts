import { Component, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PerguntaService } from '../../services/pergunta.service';
import { VofPerguntaPublica } from '../../models/pergunta.model';

type GamePhase = 'config' | 'playing' | 'result';
type VofAnswer = 'verdadeiro' | 'falso';

interface VofRecord {
  afirmacao: string;
  respostaDada: string;
  gabarito: string;
  correta: boolean;
}

@Component({
  selector: 'app-vof',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './vof.html',
  styleUrl: './vof.scss'
})
export class Vof implements OnDestroy {
  phase: GamePhase = 'config';

  dificuldade = '';
  testamento = '';
  quantidade = 10;

  questions: VofPerguntaPublica[] = [];
  currentIndex = signal(0);
  timerSeconds = signal(15);
  selectedAnswer: VofAnswer | '' = '';
  waitingFeedback = false;
  feedback: { correta: boolean; gabarito: VofAnswer } | null = null;
  records: VofRecord[] = [];
  loading = false;
  error = '';

  private timerInterval?: ReturnType<typeof setInterval>;

  readonly currentQuestion = computed(() => this.questions[this.currentIndex()] ?? null);
  readonly timerPercent = computed(() => (this.timerSeconds() / 15) * 100);
  readonly score = computed(() => this.records.filter(record => record.correta).length);
  readonly percentage = computed(() =>
    this.questions.length ? Math.round((this.score() / this.questions.length) * 100) : 0
  );

  constructor(private perguntaService: PerguntaService) {}

  startGame() {
    this.loading = true;
    this.error = '';
    this.perguntaService
      .getVerdadeiroOuFalso(this.quantidade, this.dificuldade || undefined, this.testamento || undefined)
      .subscribe({
        next: questions => {
          if (questions.length === 0) {
            this.error = 'Nenhuma afirmação encontrada com os filtros selecionados.';
            this.loading = false;
            return;
          }

          this.questions = questions;
          this.currentIndex.set(0);
          this.records = [];
          this.phase = 'playing';
          this.loading = false;
          this.startTimer();
        },
        error: () => {
          this.error = 'Erro ao carregar afirmações. Verifique se o backend está rodando em http://localhost:5000.';
          this.loading = false;
        }
      });
  }

  chooseAnswer(answer: VofAnswer) {
    if (this.waitingFeedback) return;
    this.selectedAnswer = answer;
    clearInterval(this.timerInterval);
    this.submitAnswer(answer);
  }

  restart() {
    clearInterval(this.timerInterval);
    this.phase = 'config';
    this.questions = [];
    this.records = [];
    this.feedback = null;
  }

  private startTimer() {
    this.timerSeconds.set(15);
    this.selectedAnswer = '';
    this.waitingFeedback = false;
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

  private submitAnswer(answer: VofAnswer | '') {
    const current = this.currentQuestion();
    if (!current || this.waitingFeedback) return;
    this.waitingFeedback = true;

    this.perguntaService
      .verificarVerdadeiroOuFalso(current.sessaoId, current.indice, answer || 'falso')
      .subscribe({
        next: result => {
          const missedByTimeout = answer === '';
          this.feedback = {
            correta: missedByTimeout ? false : result.correta,
            gabarito: result.gabarito
          };
          this.records.push({
            afirmacao: current.afirmacao,
            respostaDada: answer || '(sem resposta)',
            gabarito: result.gabarito,
            correta: missedByTimeout ? false : result.correta
          });
          setTimeout(() => this.nextQuestion(), 1500);
        },
        error: () => this.nextQuestion()
      });
  }

  private nextQuestion() {
    if (this.currentIndex() < this.questions.length - 1) {
      this.currentIndex.update(index => index + 1);
      this.startTimer();
      return;
    }

    clearInterval(this.timerInterval);
    this.phase = 'result';
  }

  ngOnDestroy() {
    clearInterval(this.timerInterval);
  }
}
