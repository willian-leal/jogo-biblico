import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PerguntaService } from '../../services/pergunta.service';
import { Dificuldade, SugerirPerguntaRequest, Testamento } from '../../models/pergunta.model';

@Component({
  selector: 'app-sugerir-pergunta',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './sugerir-pergunta.html',
  styleUrl: './sugerir-pergunta.scss'
})
export class SugerirPergunta {
  form: SugerirPerguntaRequest = {
    nome: '',
    contato: '',
    pergunta: '',
    alternativaA: '',
    alternativaB: '',
    alternativaC: '',
    alternativaD: '',
    respostaCorreta: '',
    referencia: '',
    dificuldade: 'medio' as Dificuldade,
    testamento: '' as Testamento,
    observacao: ''
  };

  sending = false;
  sent = false;
  error = '';

  constructor(private perguntaService: PerguntaService) {}

  submit() {
    if (this.sending || !this.form.nome.trim() || !this.form.pergunta.trim() || !this.form.respostaCorreta.trim()) {
      this.error = 'Preencha nome, pergunta e resposta correta.';
      return;
    }

    this.sending = true;
    this.error = '';
    this.perguntaService.sugerirPergunta(this.form).subscribe({
      next: () => {
        this.sending = false;
        this.sent = true;
        this.form = {
          nome: '',
          contato: '',
          pergunta: '',
          alternativaA: '',
          alternativaB: '',
          alternativaC: '',
          alternativaD: '',
          respostaCorreta: '',
          referencia: '',
          dificuldade: 'medio',
          testamento: '',
          observacao: ''
        };
      },
      error: () => {
        this.sending = false;
        this.error = 'Nao foi possivel enviar agora.';
      }
    });
  }
}
