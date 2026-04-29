import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PerguntaService } from '../../services/pergunta.service';

@Component({
  selector: 'app-report-issue',
  imports: [CommonModule, FormsModule],
  templateUrl: './report-issue.html',
  styleUrl: './report-issue.scss'
})
export class ReportIssue {
  @Input() modo = '';
  @Input() perguntaId = '';
  @Input() contexto = '';

  open = false;
  motivo = 'Pergunta com problema';
  detalhe = '';
  sending = false;
  sent = false;
  error = '';

  constructor(private perguntaService: PerguntaService) {}

  toggle() {
    this.open = !this.open;
    this.sent = false;
    this.error = '';
  }

  submit() {
    if (this.sending) return;

    this.sending = true;
    this.error = '';
    this.perguntaService
      .relatarProblema({
        modo: this.modo,
        perguntaId: this.perguntaId || undefined,
        contexto: this.contexto || undefined,
        motivo: this.motivo,
        detalhe: this.detalhe.trim() || undefined
      })
      .subscribe({
        next: () => {
          this.sending = false;
          this.sent = true;
          this.detalhe = '';
        },
        error: () => {
          this.sending = false;
          this.error = 'Nao foi possivel enviar agora.';
        }
      });
  }
}
