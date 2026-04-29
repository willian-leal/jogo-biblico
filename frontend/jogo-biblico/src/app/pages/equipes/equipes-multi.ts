import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { EquipesHubService } from '../../services/equipes-hub.service';
import { RoomShareService } from '../../services/room-share.service';
import {
  EquipeMultiEquipes,
  EstadoSalaEquipes,
  PerguntaDaVezEvent,
  ResultadoRespostaEvent
} from '../../models/equipes-multi.model';

type MultiPhase = 'config' | 'conectando' | 'lobby' | 'transition' | 'playing' | 'result';
type ConfigMode = 'criar' | 'entrar' | 'assistir';

@Component({
  selector: 'app-equipes-multi',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './equipes-multi.html',
  styleUrl: './equipes-multi.scss'
})
export class EquipesMulti implements OnInit, OnDestroy {
  phase = signal<MultiPhase>('config');
  configMode = signal<ConfigMode>('criar');

  nomeEquipe = '';
  codigoEntrada = '';
  quantidade = 10;
  dificuldade = '';
  testamento = '';

  estadoSala = signal<EstadoSalaEquipes | null>(null);
  minhaEquipe = signal('');
  ehAnfitriao = signal(false);
  ehEspectador = signal(false);
  codigoSala = signal('');
  ranking = signal<EquipeMultiEquipes[]>([]);

  perguntaDaVez = signal<PerguntaDaVezEvent | null>(null);
  aguardandoEquipe = signal('');
  resultadoResposta = signal<ResultadoRespostaEvent | null>(null);
  feedback = signal<{ type: 'ok' | 'err'; message: string } | null>(null);
  erro = signal('');
  aguardando = signal(false);
  timerSeconds = signal(30);
  addTimeUses = signal(0);
  joinUrl = signal('');
  spectatorUrl = signal('');
  qrCodeUrl = signal('');
  shareFeedback = signal('');
  connectionMessage = signal('');

  readonly ehMinhavez = computed(
    () => this.estadoSala()?.nomeEquipeAtual === this.minhaEquipe()
  );

  private timerId: number | null = null;
  private submittedTurn = false;
  private subs: Subscription[] = [];

  constructor(
    private hub: EquipesHubService,
    private route: ActivatedRoute,
    private roomShare: RoomShareService
  ) {}

  ngOnInit(): void {
    const codigo = this.route.snapshot.queryParamMap.get('sala');
    const modo = this.route.snapshot.queryParamMap.get('modo');
    if (codigo) {
      this.codigoEntrada = codigo.toUpperCase();
      this.configMode.set(modo === 'assistir' ? 'assistir' : 'entrar');
    }

    this.subs.push(
      this.hub.salaCriada$.subscribe(e => {
        this.codigoSala.set(e.codigoSala);
        this.minhaEquipe.set(e.minhaEquipe);
        this.ehAnfitriao.set(true);
        this.ehEspectador.set(false);
        this.estadoSala.set(e.estadoSala);
        this.updateShareLinks(e.codigoSala);
        this.phase.set('lobby');
      }),

      this.hub.entradaConfirmada$.subscribe(e => {
        this.minhaEquipe.set(e.minhaEquipe);
        this.estadoSala.set(e.estadoSala);
        this.codigoSala.set(e.estadoSala.codigoSala);
        this.updateShareLinks(e.estadoSala.codigoSala);
        this.ehEspectador.set(false);
        this.phase.set('lobby');
      }),

      this.hub.jogadorEntrou$.subscribe(e => {
        const sala = this.estadoSala();
        if (!sala) return;
        this.estadoSala.set({ ...sala, equipes: e.equipes });
      }),

      this.hub.proximaRodada$.subscribe(e => {
        this.stopTimer();
        this.estadoSala.set(e);
        this.perguntaDaVez.set(null);
        this.resultadoResposta.set(null);
        this.feedback.set(null);
        this.aguardandoEquipe.set('');
        this.aguardando.set(false);
        this.addTimeUses.set(0);
        this.submittedTurn = false;
        this.phase.set('transition');
      }),

      this.hub.perguntaDaVez$.subscribe(e => {
        this.perguntaDaVez.set(e);
        this.resultadoResposta.set(null);
        this.feedback.set(null);
        this.aguardando.set(false);
        this.timerSeconds.set(30);
        this.submittedTurn = false;
        this.phase.set('playing');
        if (this.ehMinhavez()) this.startTimer();
        else this.stopTimer();
      }),

      this.hub.aguardandoResposta$.subscribe(e => {
        this.stopTimer();
        this.estadoSala.set(e.estadoSala);
        this.perguntaDaVez.set(null);
        this.resultadoResposta.set(null);
        this.feedback.set(null);
        this.aguardandoEquipe.set(e.nomeEquipe);
        this.phase.set('playing');
      }),

      this.hub.tempoAdicionado$.subscribe(e => {
        if (e.nomeEquipe === this.estadoSala()?.nomeEquipeAtual) {
          this.addTimeUses.set(e.addTimeUsesTurno);
          if (this.ehMinhavez()) this.timerSeconds.update(value => value + 10);
        }
      }),

      this.hub.resultadoResposta$.subscribe(e => {
        this.stopTimer();
        this.resultadoResposta.set(e);
        this.estadoSala.update(s => s ? { ...s, equipes: e.equipes } : s);
        this.feedback.set({
          type: e.correta ? 'ok' : 'err',
          message: e.correta
            ? `${e.nomeEquipe} acertou e ganhou ${e.pontos} ponto${e.pontos === 1 ? '' : 's'}.`
            : `${e.nomeEquipe} errou. Resposta: ${e.respostaCorreta}`
        });
        this.aguardando.set(false);
      }),

      this.hub.jogoEncerrado$.subscribe(e => {
        this.stopTimer();
        this.ranking.set(e.ranking);
        this.phase.set('result');
      }),

      this.hub.entradaEspectador$.subscribe(e => {
        this.ehEspectador.set(true);
        this.estadoSala.set(e.estadoSala);
        this.codigoSala.set(e.estadoSala.codigoSala);
        this.minhaEquipe.set('');
        this.perguntaDaVez.set(e.estadoSala.perguntaAtual ?? null);
        this.updateShareLinks(e.estadoSala.codigoSala);
        this.phase.set(this.mapPhase(e.estadoSala.fase));
      }),

      this.hub.jogadorSaiu$.subscribe(e => {
        if (e.jogoEncerrado) {
          this.erro.set(e.eraAnfitriao
            ? 'O anfitriao saiu. O jogo foi encerrado.'
            : 'O jogo foi encerrado.');
          this.voltarParaConfig(true);
        }
      }),

      this.hub.erroSala$.subscribe(msg => {
        this.erro.set(msg);
        this.aguardando.set(false);
      }),

      this.hub.reconectando$.subscribe(() => {
        this.connectionMessage.set('Reconectando ao servidor...');
      }),

      this.hub.reconectado$.subscribe(() => {
        this.connectionMessage.set('Conexao restabelecida.');
        window.setTimeout(() => this.connectionMessage.set(''), 2500);
      }),

      this.hub.conexaoFechada$.subscribe(() => {
        if (this.phase() !== 'config') this.connectionMessage.set('Conexao encerrada.');
      })
    );
  }

  async criarSala(): Promise<void> {
    if (!this.nomeEquipe.trim()) { this.erro.set('Informe o nome da sua equipe.'); return; }
    this.erro.set('');
    this.phase.set('conectando');
    try {
      await this.hub.conectar();
      await this.hub.criarSalaEquipes({
        nomeEquipe: this.nomeEquipe.trim(),
        quantidade: this.quantidade,
        dificuldade: this.dificuldade || undefined,
        testamento: this.testamento || undefined
      });
    } catch {
      this.erro.set('Nao foi possivel conectar ao servidor. Verifique se o backend esta rodando.');
      this.phase.set('config');
    }
  }

  async entrarNaSala(): Promise<void> {
    if (!this.codigoEntrada.trim()) { this.erro.set('Informe o codigo da sala.'); return; }
    if (!this.nomeEquipe.trim()) { this.erro.set('Informe o nome da sua equipe.'); return; }
    this.erro.set('');
    this.phase.set('conectando');
    try {
      await this.hub.conectar();
      await this.hub.entrarNaSalaEquipes(this.codigoEntrada.trim(), this.nomeEquipe.trim());
    } catch {
      this.erro.set('Nao foi possivel conectar ao servidor.');
      this.phase.set('config');
    }
  }

  async entrarComoEspectador(): Promise<void> {
    if (!this.codigoEntrada.trim()) { this.erro.set('Informe o codigo da sala.'); return; }
    this.erro.set('');
    this.phase.set('conectando');
    try {
      await this.hub.conectar();
      await this.hub.entrarComoEspectador(this.codigoEntrada.trim());
    } catch {
      this.erro.set('Nao foi possivel conectar ao servidor.');
      this.phase.set('config');
    }
  }

  async iniciarJogo(): Promise<void> {
    this.erro.set('');
    await this.hub.iniciarJogoEquipes();
  }

  async marcarPronto(): Promise<void> {
    if (!this.ehMinhavez() || this.aguardando()) return;
    this.aguardando.set(true);
    await this.hub.marcarProntoEquipes();
  }

  async adicionarTempo(): Promise<void> {
    if (!this.ehMinhavez() || this.aguardando()) return;
    await this.hub.adicionarTempoEquipes();
  }

  async responder(resposta: string): Promise<void> {
    if (!this.ehMinhavez() || this.aguardando() || this.submittedTurn) return;
    this.submittedTurn = true;
    this.aguardando.set(true);
    this.stopTimer();
    await this.hub.responderEquipes(resposta, this.timerSeconds());
  }

  async forcarAvanco(): Promise<void> {
    await this.hub.avancarRodadaEquipes();
  }

  async copiarCodigo(): Promise<void> {
    const copied = await this.roomShare.copyText(this.codigoSala());
    this.showShareFeedback(copied ? 'Codigo copiado.' : 'Nao foi possivel copiar.');
  }

  async copiarLink(role: 'entrar' | 'assistir'): Promise<void> {
    const link = role === 'entrar' ? this.joinUrl() : this.spectatorUrl();
    const copied = await this.roomShare.copyText(link);
    this.showShareFeedback(copied ? 'Link copiado.' : 'Nao foi possivel copiar.');
  }

  timerPercent(): number {
    return Math.max(0, Math.min(100, (this.timerSeconds() / 30) * 100));
  }

  scorePreview(): number {
    const pergunta = this.perguntaDaVez();
    if (!pergunta) return 0;
    const base = pergunta.dificuldade === 'dificil' ? 3 : pergunta.dificuldade === 'medio' ? 2 : 1;
    const speedBonus = this.timerSeconds() > 20 ? 1 : 0;
    return Math.max(0, base + speedBonus - this.addTimeUses());
  }

  jogarNovamente(): void {
    const equipeAtual = this.minhaEquipe();
    this.voltarParaConfig();
    this.nomeEquipe = equipeAtual || this.nomeEquipe;
    this.configMode.set('criar');
  }

  voltarParaConfig(manterErro = false): void {
    this.stopTimer();
    this.hub.desconectar();
    this.phase.set('config');
    this.estadoSala.set(null);
    this.codigoSala.set('');
    this.minhaEquipe.set('');
    this.ehAnfitriao.set(false);
    this.ehEspectador.set(false);
    this.ranking.set([]);
    this.perguntaDaVez.set(null);
    this.resultadoResposta.set(null);
    this.feedback.set(null);
    if (!manterErro) this.erro.set('');
    this.aguardando.set(false);
    this.aguardandoEquipe.set('');
    this.addTimeUses.set(0);
    this.joinUrl.set('');
    this.spectatorUrl.set('');
    this.qrCodeUrl.set('');
    this.shareFeedback.set('');
    this.connectionMessage.set('');
    this.submittedTurn = false;
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.subs.forEach(s => s.unsubscribe());
    this.hub.desconectar();
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerId = window.setInterval(() => {
      const next = this.timerSeconds() - 1;
      this.timerSeconds.set(Math.max(0, next));
      if (next <= 0) {
        this.responder('');
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private mapPhase(fase: string): MultiPhase {
    if (fase === 'aguardando') return 'lobby';
    if (fase === 'transicao') return 'transition';
    if (fase === 'jogando') return 'playing';
    if (fase === 'encerrada') return 'result';
    return 'config';
  }

  private async updateShareLinks(codigoSala: string): Promise<void> {
    const joinUrl = this.roomShare.buildJoinUrl('equipes', codigoSala, 'entrar');
    const spectatorUrl = this.roomShare.buildJoinUrl('equipes', codigoSala, 'assistir');
    this.joinUrl.set(joinUrl);
    this.spectatorUrl.set(spectatorUrl);
    this.qrCodeUrl.set(await this.roomShare.buildQrCode(joinUrl));
  }

  private showShareFeedback(message: string): void {
    this.shareFeedback.set(message);
    window.setTimeout(() => this.shareFeedback.set(''), 2200);
  }
}
