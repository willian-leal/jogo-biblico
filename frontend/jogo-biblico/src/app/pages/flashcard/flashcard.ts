import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PerguntaService } from '../../services/pergunta.service';
import { PerguntaPublica } from '../../models/pergunta.model';

type Fase = 'config' | 'revisando' | 'resultado';

interface RegistroFlashcard {
  pergunta: string;
  resposta: string;
  sabia: boolean;
}

@Component({
  selector: 'app-flashcard',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './flashcard.html',
  styleUrl: './flashcard.scss'
})
export class Flashcard {
  fase: Fase = 'config';

  // Configurações
  dificuldade = '';
  testamento = '';
  quantidade = 20;

  // Estado
  perguntas: PerguntaPublica[] = [];
  indiceAtual = signal(0);
  revelada = signal(false);
  respostaCorreta = signal('');
  carregandoResposta = signal(false);
  acertos = signal(0);
  erros = signal(0);
  registros: RegistroFlashcard[] = [];
  carregando = false;
  erro = '';

  readonly perguntaAtual = computed(() => this.perguntas[this.indiceAtual()] ?? null);
  readonly progresso = computed(() => ({
    atual: this.indiceAtual() + 1,
    total: this.perguntas.length
  }));

  constructor(private perguntaService: PerguntaService) {}

  iniciar() {
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
          this.acertos.set(0);
          this.erros.set(0);
          this.registros = [];
          this.resetarCard();
          this.fase = 'revisando';
          this.carregando = false;
        },
        error: () => {
          this.erro = 'Erro ao carregar perguntas. Verifique se o backend está rodando em http://localhost:5000.';
          this.carregando = false;
        }
      });
  }

  // Chama verificarResposta para obter a resposta correta sem expô-la no GET
  revelar() {
    const atual = this.perguntaAtual();
    if (!atual) return;
    this.carregandoResposta.set(true);
    this.perguntaService.verificarResposta(atual.id, '').subscribe({
      next: resultado => {
        this.respostaCorreta.set(resultado.respostaCorreta);
        this.revelada.set(true);
        this.carregandoResposta.set(false);
      },
      error: () => this.carregandoResposta.set(false)
    });
  }

  responder(sabia: boolean) {
    const atual = this.perguntaAtual();
    if (sabia) this.acertos.update(n => n + 1);
    else this.erros.update(n => n + 1);

    if (atual) {
      this.registros.push({
        pergunta: atual.pergunta,
        resposta: this.respostaCorreta(),
        sabia
      });
    }
    this.proxima();
  }

  private proxima() {
    if (this.indiceAtual() < this.perguntas.length - 1) {
      this.indiceAtual.update(i => i + 1);
      this.resetarCard();
    } else {
      this.fase = 'resultado';
    }
  }

  private resetarCard() {
    this.revelada.set(false);
    this.respostaCorreta.set('');
  }

  reiniciar() {
    this.fase = 'config';
    this.perguntas = [];
  }
}
