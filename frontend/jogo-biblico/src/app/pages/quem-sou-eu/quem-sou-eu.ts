import { Component, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RulesScreen, GameRule } from '../../shared/rules-screen/rules-screen';
import { PERSONAGENS, Personagem } from './personagens';
import { ReportIssue } from '../../shared/report-issue/report-issue';

type GamePhase = 'rules' | 'config' | 'transition' | 'acting' | 'result';
type ActingResult = 'acertou' | 'pulou' | 'tempo';

interface Team {
  name: string;
  score: number;
}

interface TurnRecord {
  team: string;
  personagem: string;
  acertou: boolean;
  pontos: number;
}

@Component({
  selector: 'app-quem-sou-eu',
  imports: [CommonModule, FormsModule, RouterLink, RulesScreen, ReportIssue],
  templateUrl: './quem-sou-eu.html',
  styleUrl: './quem-sou-eu.scss'
})
export class QuemSouEu implements OnDestroy {
  phase: GamePhase = 'rules';

  readonly rules: GameRule[] = [
    { icon: '🎭', text: 'O ator recebe um personagem bíblico e faz mímica para a equipe' },
    { icon: '🚫', text: 'Proibido falar, soletrar ou usar linguagem de sinais' },
    { icon: '⏱', text: 'Tempo por dificuldade: Fácil 45s · Médio 60s · Difícil 90s' },
    { icon: '⚡', text: 'Acertou com mais da metade do tempo restante: +1pt de bônus' },
    { icon: '↪', text: 'Pular é permitido — sem penalidade' }
  ];

  teamCount = 2;
  teams: Team[] = [
    { name: 'Equipe 1', score: 0 },
    { name: 'Equipe 2', score: 0 }
  ];
  dificuldade = '';
  cardsPerTeam = 5;

  cards: Personagem[] = [];
  currentIndex = signal(0);
  timerSeconds = signal(60);
  timerMax = signal(60);
  actingStarted = false;
  characterVisible = false;
  actingResult: ActingResult | null = null;
  pontosGanhos = 0;
  records: TurnRecord[] = [];
  error = '';

  private timerInterval?: ReturnType<typeof setInterval>;

  readonly currentCard = computed(() => this.cards[this.currentIndex()] ?? null);
  readonly currentTeamIndex = computed(() => this.currentIndex() % this.teams.length);
  readonly currentTeam = computed(() => this.teams[this.currentTeamIndex()] ?? this.teams[0]);
  readonly totalCards = computed(() => this.teamCount * this.cardsPerTeam);
  readonly timerPercent = computed(() => Math.min(100, (this.timerSeconds() / this.timerMax()) * 100));
  readonly ranking = computed(() =>
    [...this.teams].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  );
  readonly winners = computed(() => {
    const best = Math.max(...this.teams.map(t => t.score));
    return this.teams.filter(t => t.score === best);
  });

  goToConfig() {
    this.phase = 'config';
  }

  updateTeamCount() {
    const next: Team[] = [];
    for (let i = 0; i < this.teamCount; i++) {
      next.push(this.teams[i] ?? { name: `Equipe ${i + 1}`, score: 0 });
    }
    this.teams = next;
  }

  startGame() {
    const pool = this.dificuldade
      ? PERSONAGENS.filter(p => p.dificuldade === this.dificuldade)
      : [...PERSONAGENS];

    const total = this.totalCards();
    if (pool.length < total) {
      this.error = `Apenas ${pool.length} personagens disponíveis para esta dificuldade. Reduza a quantidade ou escolha "Todas".`;
      return;
    }

    this.error = '';
    this.teams = this.teams.map((t, i) => ({
      name: t.name.trim() || `Equipe ${i + 1}`,
      score: 0
    }));
    this.cards = this.shuffle(pool).slice(0, total);
    this.currentIndex.set(0);
    this.records = [];
    this.prepareNextTurn();
  }

  readyForTurn() {
    const duration = this.getTimerDuration(this.currentCard()?.dificuldade ?? 'medio');
    this.timerMax.set(duration);
    this.timerSeconds.set(duration);
    this.actingStarted = false;
    this.characterVisible = false;
    this.phase = 'acting';
  }

  startActing() {
    this.characterVisible = false;
    this.actingStarted = true;
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timerSeconds.update(s => s - 1);
      if (this.timerSeconds() <= 0) {
        clearInterval(this.timerInterval);
        this.registerResult(false);
      }
    }, 1000);
  }

  toggleCharacterVisibility() {
    this.characterVisible = !this.characterVisible;
  }

  acertou() {
    if (this.actingResult) return;
    clearInterval(this.timerInterval);
    this.registerResult(true);
  }

  pular() {
    if (this.actingResult) return;
    clearInterval(this.timerInterval);
    this.registerResult(false, true);
  }

  newGame() {
    clearInterval(this.timerInterval);
    this.phase = 'config';
    this.cards = [];
    this.records = [];
  }

  playAgain() {
    this.startGame();
  }

  private prepareNextTurn() {
    this.phase = 'transition';
    this.actingResult = null;
    this.actingStarted = false;
    this.characterVisible = false;
    this.pontosGanhos = 0;
    clearInterval(this.timerInterval);
  }

  private registerResult(acertou: boolean, pulou = false) {
    const card = this.currentCard();
    if (!card) return;

    let pontos = 0;
    if (acertou) {
      pontos = this.calcScore(card.dificuldade, this.timerSeconds(), this.timerMax());
      this.currentTeam().score += pontos;
    }

    this.pontosGanhos = pontos;
    this.actingResult = pulou ? 'pulou' : acertou ? 'acertou' : 'tempo';

    this.records.push({ team: this.currentTeam().name, personagem: card.nome, acertou, pontos });

    setTimeout(() => this.nextTurn(), 1800);
  }

  private nextTurn() {
    if (this.currentIndex() < this.cards.length - 1) {
      this.currentIndex.update(i => i + 1);
      this.prepareNextTurn();
      return;
    }
    clearInterval(this.timerInterval);
    this.phase = 'result';
  }

  private calcScore(dificuldade: string, timeRemaining: number, timerMax: number): number {
    const base = dificuldade === 'facil' ? 1 : dificuldade === 'medio' ? 2 : 3;
    const speedBonus = timeRemaining > timerMax / 2 ? 1 : 0;
    return base + speedBonus;
  }

  private getTimerDuration(dificuldade: string): number {
    if (dificuldade === 'facil') return 45;
    if (dificuldade === 'dificil') return 90;
    return 60;
  }

  private shuffle<T>(items: T[]): T[] {
    return [...items].sort(() => Math.random() - 0.5);
  }

  ngOnDestroy() {
    clearInterval(this.timerInterval);
  }
}
