import { Component, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PerguntaService } from '../../services/pergunta.service';
import { PerguntaPublica } from '../../models/pergunta.model';

type Fase = 'config' | 'jogando' | 'resultado';

interface Registro {
  pergunta: string;
  respostaDada: string;
  respostaCorreta: string;
  correta: boolean;
}

@Component({
  selector: 'app-quiz',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './quiz.html',
  styleUrl: './quiz.scss'
})
export class Quiz implements OnDestroy {
  fase: Fase = 'config';

  // Configurações
  dificuldade = '';
  testamento = '';
  quantidade = 10;

  // Estado do jogo
  perguntas: PerguntaPublica[] = [];
  indiceAtual = signal(0);
  timerSegundos = signal(30);
  respostaSelecionada = '';
  aguardandoFeedback = false;
  feedback: { correta: boolean; respostaCorreta: string } | null = null;
  registros: Registro[] = [];
  carregando = false;
  erro = '';

  private timerInterval?: ReturnType<typeof setInterval>;

  readonly perguntaAtual = computed(() => this.perguntas[this.indiceAtual()] ?? null);
  readonly timerPercent = computed(() => (this.timerSegundos() / 30) * 100);
  readonly pontuacao = computed(() => this.registros.filter(r => r.correta).length);

  constructor(private perguntaService: PerguntaService) {}

  iniciarQuiz() {
    this.carregando = true;
    this.erro = '';
    this.perguntaService
      .getPerguntas(this.quantidade, this.dificuldade || undefined, this.testamento || undefined)
      .subscribe({
        next: perguntas => {
          if (perguntas.length === 0) {
            this.erro = 'Nenhuma pergunta encontrada com os filtros selecionados.';
            this.carregando = false;
            return;
          }
          this.perguntas = perguntas;
          this.indiceAtual.set(0);
          this.registros = [];
          this.fase = 'jogando';
          this.carregando = false;
          this.iniciarTimer();
        },
        error: () => {
          this.erro = 'Erro ao carregar perguntas. Verifique se o backend está rodando em http://localhost:5000.';
          this.carregando = false;
        }
      });
  }

  adicionarTempo() {
    if (!this.aguardandoFeedback) this.timerSegundos.update(s => s + 10);
  }

  private iniciarTimer() {
    this.timerSegundos.set(30);
    this.respostaSelecionada = '';
    this.aguardandoFeedback = false;
    this.feedback = null;
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timerSegundos.update(s => s - 1);
      if (this.timerSegundos() <= 0) {
        clearInterval(this.timerInterval);
        this.registrarResposta('');
      }
    }, 1000);
  }

  selecionarResposta(alternativa: string) {
    if (this.aguardandoFeedback) return;
    this.respostaSelecionada = alternativa;
    clearInterval(this.timerInterval);
    this.registrarResposta(alternativa);
  }

  private registrarResposta(resposta: string) {
    const atual = this.perguntaAtual();
    if (!atual || this.aguardandoFeedback) return;
    this.aguardandoFeedback = true;

    this.perguntaService.verificarResposta(atual.id, resposta).subscribe({
      next: resultado => {
        this.feedback = resultado;
        this.registros.push({
          pergunta: atual.pergunta,
          respostaDada: resposta || '(sem resposta)',
          respostaCorreta: resultado.respostaCorreta,
          correta: resultado.correta
        });
        setTimeout(() => this.proximaPergunta(), 1800);
      },
      error: () => this.proximaPergunta()
    });
  }

  private proximaPergunta() {
    if (this.indiceAtual() < this.perguntas.length - 1) {
      this.indiceAtual.update(i => i + 1);
      this.iniciarTimer();
    } else {
      clearInterval(this.timerInterval);
      this.fase = 'resultado';
    }
  }

  reiniciar() {
    clearInterval(this.timerInterval);
    this.fase = 'config';
    this.perguntas = [];
    this.registros = [];
  }

  getCorAlternativa(alternativa: string): string {
    if (!this.feedback) return alternativa === this.respostaSelecionada ? 'selecionada' : '';
    if (alternativa === this.feedback.respostaCorreta) return 'correta';
    if (alternativa === this.respostaSelecionada && !this.feedback.correta) return 'errada';
    return '';
  }

  ngOnDestroy() {
    clearInterval(this.timerInterval);
  }
}
