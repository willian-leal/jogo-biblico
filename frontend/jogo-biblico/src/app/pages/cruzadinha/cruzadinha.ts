import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PerguntaService } from '../../services/pergunta.service';
import {
  CruzadinhaPalavraPublica,
  CruzadinhaPublica,
  CruzadinhaResposta
} from '../../models/pergunta.model';
import { GameRule, RulesScreen } from '../../shared/rules-screen/rules-screen';
import { ReportIssue } from '../../shared/report-issue/report-issue';

type GamePhase = 'rules' | 'config' | 'playing' | 'result';
type WordStatus = 'correct' | 'wrong';

@Component({
  selector: 'app-cruzadinha',
  imports: [CommonModule, FormsModule, RouterLink, RulesScreen, ReportIssue],
  templateUrl: './cruzadinha.html',
  styleUrl: './cruzadinha.scss'
})
export class Cruzadinha {
  phase: GamePhase = 'rules';

  readonly rules: GameRule[] = [
    { icon: 'A1', text: 'Leia as dicas e preencha cada palavra na grade' },
    { icon: 'H/V', text: 'As palavras podem estar na horizontal ou na vertical' },
    { icon: '?', text: 'O backend guarda as respostas, entao a grade nao revela o gabarito' },
    { icon: 'OK', text: 'Use Verificar para conferir quais palavras estao certas' }
  ];

  dificuldade = '';
  testamento = '';
  quantidade = 5;
  puzzle: CruzadinhaPublica | null = null;
  letters: Record<string, string> = {};
  statuses: Record<string, WordStatus> = {};
  loading = false;
  error = '';
  feedback = '';

  readonly rows = computed(() =>
    Array.from({ length: this.puzzle?.tamanho ?? 0 }, (_, index) => index)
  );

  readonly activeWords = computed(() => this.puzzle?.palavras ?? []);
  readonly horizontalWords = computed(() =>
    this.activeWords().filter(word => word.direcao === 'horizontal')
  );
  readonly verticalWords = computed(() =>
    this.activeWords().filter(word => word.direcao === 'vertical')
  );
  readonly reportContext = computed(() =>
    this.activeWords()
      .map(word => `${word.numero}. ${word.dica}`)
      .join(' | ')
  );

  constructor(private perguntaService: PerguntaService) {}

  goToConfig() {
    this.phase = 'config';
  }

  startGame() {
    this.loading = true;
    this.error = '';
    this.feedback = '';
    this.perguntaService
      .getCruzadinha(this.quantidade, this.dificuldade || undefined, this.testamento || undefined)
      .subscribe({
        next: puzzle => {
          this.puzzle = puzzle;
          this.letters = {};
          this.statuses = {};
          this.loading = false;
          this.phase = 'playing';
        },
        error: () => {
          this.error = 'Erro ao carregar cruzadinha. Verifique se o backend esta rodando em http://localhost:5000.';
          this.loading = false;
        }
      });
  }

  verify() {
    if (!this.puzzle) return;

    const respostas: CruzadinhaResposta[] = this.puzzle.palavras.map(word => ({
      id: word.id,
      resposta: this.getWordAnswer(word)
    }));

    this.perguntaService.verificarCruzadinha(this.puzzle.sessaoId, respostas).subscribe({
      next: result => {
        const nextStatuses: Record<string, WordStatus> = {};
        for (const id of result.corretas) nextStatuses[id] = 'correct';
        for (const id of result.erradas) nextStatuses[id] = 'wrong';
        this.statuses = nextStatuses;

        if (result.concluida) {
          this.feedback = 'Cruzadinha completa!';
          setTimeout(() => (this.phase = 'result'), 900);
          return;
        }

        this.feedback = `${result.corretas.length} certa(s), ${result.erradas.length} para revisar.`;
      },
      error: () => {
        this.feedback = 'Nao foi possivel verificar agora.';
      }
    });
  }

  clearGrid() {
    this.letters = {};
    this.statuses = {};
    this.feedback = '';
  }

  newGame() {
    this.phase = 'config';
    this.puzzle = null;
    this.letters = {};
    this.statuses = {};
    this.feedback = '';
  }

  playAgain() {
    this.startGame();
  }

  getCellValue(row: number, col: number): string {
    return this.letters[this.cellKey(row, col)] ?? '';
  }

  setCellValue(row: number, col: number, value: string) {
    const letter = this.normalizeInput(value);
    const key = this.cellKey(row, col);
    if (letter) {
      this.letters = { ...this.letters, [key]: letter };
      return;
    }

    const next = { ...this.letters };
    delete next[key];
    this.letters = next;
  }

  isActiveCell(row: number, col: number): boolean {
    return this.activeWords().some(word => this.wordCells(word).some(cell => cell.row === row && cell.col === col));
  }

  clueNumberAt(row: number, col: number): number | null {
    const word = this.activeWords().find(item => item.linha === row && item.coluna === col);
    return word?.numero ?? null;
  }

  getWordStatus(word: CruzadinhaPalavraPublica): WordStatus | '' {
    return this.statuses[word.id] ?? '';
  }

  private getWordAnswer(word: CruzadinhaPalavraPublica): string {
    return this.wordCells(word)
      .map(cell => this.getCellValue(cell.row, cell.col))
      .join('');
  }

  private wordCells(word: CruzadinhaPalavraPublica): Array<{ row: number; col: number }> {
    return Array.from({ length: word.tamanho }, (_, index) => ({
      row: word.linha + (word.direcao === 'vertical' ? index : 0),
      col: word.coluna + (word.direcao === 'horizontal' ? index : 0)
    }));
  }

  private cellKey(row: number, col: number): string {
    return `${row}-${col}`;
  }

  private normalizeInput(value: string): string {
    return `${value ?? ''}`
      .replace(/[^a-zA-Z]/g, '')
      .slice(-1)
      .toLocaleUpperCase('pt-BR');
  }
}
