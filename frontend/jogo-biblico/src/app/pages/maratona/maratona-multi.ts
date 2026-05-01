import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { MaratonaHubService } from '../../services/maratona-hub.service';
import { RoomShareService } from '../../services/room-share.service';
import { ReportIssue } from '../../shared/report-issue/report-issue';
import {
  EquipeMaratona,
  EstadoSalaMaratona,
  ForcaIniciadaEvent,
  PerguntaMaratonaEvent,
  ResultadoChuteMaratonaEvent,
  ResultadoLetraEvent,
  ResultadoMimicaEvent,
  ResultadoRespostaMaratonaEvent,
  TipoModo,
  TransicaoModoEvent
} from '../../models/maratona.model';

type Phase = 'config' | 'conectando' | 'lobby' | 'transicao-modo' | 'transicao' | 'jogando' | 'resultado';
type ConfigMode = 'criar' | 'entrar' | 'assistir';

interface ModoSelecionado {
  tipo: TipoModo;
  label: string;
  icone: string;
  selecionado: boolean;
  quantidade: number;
  dificuldade: string;
  testamento: string;
}

@Component({
  selector: 'app-maratona-multi',
  imports: [CommonModule, FormsModule, RouterLink, ReportIssue],
  templateUrl: './maratona-multi.html',
  styleUrl: './maratona-multi.scss'
})
export class MaratonaMulti implements OnInit, OnDestroy {
  phase = signal<Phase>('config');
  configMode = signal<ConfigMode>('criar');

  nomeEquipe = '';
  codigoEntrada = '';

  modosDisponiveis: ModoSelecionado[] = [
    { tipo: 'quiz', label: 'Quiz', icone: '🎯', selecionado: false, quantidade: 5, dificuldade: '', testamento: '' },
    { tipo: 'vof', label: 'Verdadeiro ou Falso', icone: '✔', selecionado: false, quantidade: 5, dificuldade: '', testamento: '' },
    { tipo: 'forca', label: 'Forca', icone: '🔤', selecionado: false, quantidade: 5, dificuldade: '', testamento: '' },
    { tipo: 'quemsoueu', label: 'Quem Sou Eu?', icone: '🎭', selecionado: false, quantidade: 5, dificuldade: '', testamento: '' },
  ];

  estadoSala = signal<EstadoSalaMaratona | null>(null);
  minhaEquipe = signal('');
  ehAnfitriao = signal(false);
  ehEspectador = signal(false);
  codigoSala = signal('');
  ranking = signal<EquipeMaratona[]>([]);

  // Estado de jogo
  perguntaDaVez = signal<PerguntaMaratonaEvent | null>(null);
  forcaEstado = signal<ForcaIniciadaEvent | null>(null);
  personagemMimica = signal('');
  transicaoModo = signal<TransicaoModoEvent | null>(null);
  resultadoResposta = signal<ResultadoRespostaMaratonaEvent | ResultadoMimicaEvent | null>(null);
  resultadoLetra = signal<ResultadoLetraEvent | null>(null);
  resultadoChute = signal<ResultadoChuteMaratonaEvent | null>(null);
  chuteAberto = signal(false);
  chuteTentativa = '';
  feedback = signal<{ type: 'ok' | 'err'; message: string } | null>(null);
  aguardando = signal(false);
  timerSeconds = signal(30);
  timerMax = signal(30);
  addTimeUses = signal(0);
  erro = signal('');
  connectionMessage = signal('');
  joinUrl = signal('');
  spectatorUrl = signal('');
  qrCodeUrl = signal('');
  shareFeedback = signal('');

  private submittedTurn = false;
  private timerId: number | null = null;
  private subs: Subscription[] = [];

  readonly ehMinhavez = computed(
    () => this.estadoSala()?.nomeEquipeAtual === this.minhaEquipe()
  );

  readonly modoAtual = computed(() => this.estadoSala()?.modoAtual ?? '');

  readonly alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  constructor(
    private hub: MaratonaHubService,
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

      this.hub.entradaEspectador$.subscribe(e => {
        this.ehEspectador.set(true);
        this.estadoSala.set(e.estadoSala);
        this.codigoSala.set(e.estadoSala.codigoSala);
        this.minhaEquipe.set('');
        this.updateShareLinks(e.estadoSala.codigoSala);
        this.phase.set(this.mapPhase(e.estadoSala.fase));
      }),

      this.hub.proximaRodada$.subscribe(e => {
        this.stopTimer();
        this.estadoSala.set(e);
        this.perguntaDaVez.set(null);
        this.forcaEstado.set(null);
        this.personagemMimica.set('');
        this.resultadoResposta.set(null);
        this.resultadoLetra.set(null);
        this.resultadoChute.set(null);
        this.feedback.set(null);
        this.aguardando.set(false);
        this.addTimeUses.set(0);
        this.chuteAberto.set(false);
        this.submittedTurn = false;
        this.phase.set('transicao');
      }),

      this.hub.perguntaDaVez$.subscribe(e => {
        this.perguntaDaVez.set(e);
        this.resultadoResposta.set(null);
        this.feedback.set(null);
        this.aguardando.set(false);
        this.submittedTurn = false;
        const max = 30;
        this.timerMax.set(max);
        this.timerSeconds.set(max);
        this.phase.set('jogando');
        this.startTimer();
      }),

      this.hub.forcaIniciada$.subscribe(e => {
        this.forcaEstado.set(e);
        this.resultadoLetra.set(null);
        this.resultadoChute.set(null);
        this.feedback.set(null);
        this.chuteAberto.set(false);
        this.chuteTentativa = '';
        this.aguardando.set(false);
        this.estadoSala.update(s => s ? {
          ...s,
          nomeEquipeAtual: e.nomeEquipeAtual,
          mascara: e.mascara,
          letrasUsadas: e.letrasUsadas,
          letrasErradas: e.letrasErradas
        } : s);
        this.phase.set('jogando');
      }),

      this.hub.personagemParaMimar$.subscribe(e => {
        this.personagemMimica.set(e.personagem);
        this.resultadoResposta.set(null);
        this.feedback.set(null);
        this.aguardando.set(false);
        this.submittedTurn = false;
        const max = 60;
        this.timerMax.set(max);
        this.timerSeconds.set(max);
        this.phase.set('jogando');
        this.startTimer();
      }),

      this.hub.mimicaIniciada$.subscribe(e => {
        this.personagemMimica.set('');
        this.resultadoResposta.set(null);
        this.feedback.set(null);
        this.aguardando.set(false);
        this.submittedTurn = false;
        const max = 60;
        this.timerMax.set(max);
        this.timerSeconds.set(max);
        this.estadoSala.update(s => s ? { ...s, nomeEquipeAtual: e.nomeEquipeAtual } : s);
        this.phase.set('jogando');
        this.startTimer();
      }),

      this.hub.tempoAdicionado$.subscribe(e => {
        if (e.nomeEquipe === this.estadoSala()?.nomeEquipeAtual) {
          this.addTimeUses.set(e.addTimeUsesTurno);
          this.timerSeconds.update(v => v + 10);
        }
      }),

      this.hub.resultadoResposta$.subscribe(e => {
        this.stopTimer();
        this.resultadoResposta.set(e);
        this.estadoSala.update(s => s ? { ...s, equipes: e.equipes } : s);
        this.feedback.set({
          type: e.correta ? 'ok' : 'err',
          message: e.correta
            ? `${e.nomeEquipe} acertou! +${e.pontos} ponto${e.pontos === 1 ? '' : 's'}`
            : `${e.nomeEquipe} errou. Resposta: ${e.respostaCorreta}`
        });
        this.aguardando.set(false);
      }),

      this.hub.resultadoMimica$.subscribe(e => {
        this.stopTimer();
        this.resultadoResposta.set(e as any);
        this.estadoSala.update(s => s ? { ...s, equipes: e.equipes } : s);
        this.feedback.set({
          type: e.acertou ? 'ok' : 'err',
          message: e.acertou
            ? `${e.nomeEquipe} acertou "${e.personagem}"! +${e.pontos} pontos`
            : `${e.nomeEquipe} não acertou. Era: ${e.personagem}`
        });
        this.aguardando.set(false);
      }),

      this.hub.resultadoLetra$.subscribe(e => {
        this.resultadoLetra.set(e);
        this.estadoSala.update(s => s ? {
          ...s,
          equipes: e.equipes,
          nomeEquipeAtual: e.nomeEquipeAtual,
          indiceEquipeAtual: e.indiceEquipeAtual,
          mascara: e.mascara,
          letrasUsadas: e.letrasUsadas,
          letrasErradas: e.letrasErradas
        } : s);
        this.forcaEstado.update(f => f ? { ...f, mascara: e.mascara, letrasUsadas: e.letrasUsadas, letrasErradas: e.letrasErradas, nomeEquipeAtual: e.nomeEquipeAtual } : f);
        if (e.finalizada) {
          this.feedback.set({ type: 'ok', message: `Palavra revelada: ${e.respostaCorreta}` });
        }
        this.aguardando.set(false);
      }),

      this.hub.chuteAberto$.subscribe(() => {
        this.chuteAberto.set(true);
        this.chuteTentativa = '';
      }),

      this.hub.chuteCancelado$.subscribe(() => {
        this.chuteAberto.set(false);
        this.chuteTentativa = '';
        this.aguardando.set(false);
      }),

      this.hub.resultadoChute$.subscribe(e => {
        this.resultadoChute.set(e);
        this.chuteAberto.set(false);
        this.estadoSala.update(s => s ? {
          ...s,
          equipes: e.equipes,
          nomeEquipeAtual: e.nomeEquipeAtual,
          indiceEquipeAtual: e.indiceEquipeAtual
        } : s);
        this.feedback.set({
          type: e.correta ? 'ok' : 'err',
          message: e.correta ? `Chute correto! +${e.pontos} pontos` : `Chute incorreto. Passou para ${e.nomeEquipeAtual}`
        });
        this.aguardando.set(false);
      }),

      this.hub.transicaoModo$.subscribe(e => {
        this.stopTimer();
        this.transicaoModo.set(e);
        this.perguntaDaVez.set(null);
        this.forcaEstado.set(null);
        this.personagemMimica.set('');
        this.resultadoResposta.set(null);
        this.feedback.set(null);
        this.phase.set('transicao-modo');
      }),

      this.hub.maratonaEncerrada$.subscribe(e => {
        this.stopTimer();
        this.ranking.set(e.ranking);
        this.phase.set('resultado');
      }),

      this.hub.jogadorSaiu$.subscribe(e => {
        if (e.jogoEncerrado) {
          this.erro.set(e.eraAnfitriao ? 'O anfitriao saiu. Maratona encerrada.' : 'A maratona foi encerrada.');
          this.voltarParaConfig(true);
        }
      }),

      this.hub.erroSala$.subscribe(msg => { this.erro.set(msg); this.aguardando.set(false); }),

      this.hub.reconectando$.subscribe(() => this.connectionMessage.set('Reconectando...')),
      this.hub.reconectado$.subscribe(() => {
        this.connectionMessage.set('Conexao restabelecida.');
        window.setTimeout(() => this.connectionMessage.set(''), 2500);
      }),
      this.hub.conexaoFechada$.subscribe(() => {
        if (this.phase() !== 'config') this.connectionMessage.set('Conexao encerrada.');
      })
    );
  }

  get modosOrdenados(): ModoSelecionado[] {
    return this.modosDisponiveis.filter(m => m.selecionado);
  }

  moverModo(tipo: TipoModo, direcao: -1 | 1): void {
    const selecionados = this.modosOrdenados;
    const posicaoAtualSelecionada = selecionados.findIndex(m => m.tipo === tipo);
    const novaPosicaoSelecionada = posicaoAtualSelecionada + direcao;
    if (posicaoAtualSelecionada < 0 || novaPosicaoSelecionada < 0 || novaPosicaoSelecionada >= selecionados.length) return;

    const modoAtual = selecionados[posicaoAtualSelecionada];
    const modoAlvo = selecionados[novaPosicaoSelecionada];
    const indiceAtual = this.modosDisponiveis.findIndex(m => m.tipo === modoAtual.tipo);
    const indiceAlvo = this.modosDisponiveis.findIndex(m => m.tipo === modoAlvo.tipo);
    [this.modosDisponiveis[indiceAtual], this.modosDisponiveis[indiceAlvo]] =
      [this.modosDisponiveis[indiceAlvo], this.modosDisponiveis[indiceAtual]];
  }

  podeSubirModo(tipo: TipoModo): boolean {
    return this.modosOrdenados.findIndex(m => m.tipo === tipo) > 0;
  }

  podeDescerModo(tipo: TipoModo): boolean {
    const index = this.modosOrdenados.findIndex(m => m.tipo === tipo);
    return index >= 0 && index < this.modosOrdenados.length - 1;
  }

  async criarSala(): Promise<void> {
    if (!this.nomeEquipe.trim()) { this.erro.set('Informe o nome da sua equipe.'); return; }
    const selecionados = this.modosDisponiveis.filter(m => m.selecionado);
    if (selecionados.length === 0) { this.erro.set('Selecione pelo menos um modo.'); return; }
    this.erro.set('');
    this.phase.set('conectando');
    try {
      await this.hub.conectar();
      await this.hub.criarSalaMaratona({
        nomeEquipe: this.nomeEquipe.trim(),
        modos: selecionados.map(m => ({
          tipo: m.tipo,
          quantidadePorEquipe: m.quantidade,
          dificuldade: m.dificuldade || undefined,
          testamento: m.testamento || undefined
        }))
      });
    } catch {
      this.erro.set('Nao foi possivel conectar ao servidor.');
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
      await this.hub.entrarNaSalaMaratona(this.codigoEntrada.trim(), this.nomeEquipe.trim());
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

  async iniciarMaratona(): Promise<void> {
    this.erro.set('');
    await this.hub.iniciarMaratona();
  }

  async iniciarProximoModo(): Promise<void> {
    this.erro.set('');
    await this.hub.iniciarProximoModo();
  }

  async marcarPronto(): Promise<void> {
    if (!this.ehMinhavez() || this.aguardando()) return;
    this.aguardando.set(true);
    await this.hub.marcarProntoMaratona();
  }

  async responder(resposta: string): Promise<void> {
    if (!this.ehMinhavez() || this.aguardando() || this.submittedTurn) return;
    this.submittedTurn = true;
    this.aguardando.set(true);
    this.stopTimer();
    await this.hub.responderMaratona(resposta, this.timerSeconds());
  }

  async acertouMimica(): Promise<void> {
    if (!this.ehMinhavez() || this.aguardando() || this.submittedTurn) return;
    this.submittedTurn = true;
    this.aguardando.set(true);
    this.stopTimer();
    await this.hub.responderMimica(true);
  }

  async errouMimica(): Promise<void> {
    if (!this.ehMinhavez() || this.aguardando() || this.submittedTurn) return;
    this.submittedTurn = true;
    this.aguardando.set(true);
    this.stopTimer();
    await this.hub.responderMimica(false);
  }

  async escolherLetra(letra: string): Promise<void> {
    if (!this.ehMinhavez() || this.aguardando()) return;
    const letrasUsadas = this.forcaEstado()?.letrasUsadas ?? this.estadoSala()?.letrasUsadas ?? [];
    if (letrasUsadas.includes(letra)) return;
    this.aguardando.set(true);
    await this.hub.escolherLetraForca(letra);
  }

  async abrirChute(): Promise<void> {
    if (!this.ehMinhavez() || this.aguardando()) return;
    await this.hub.abrirChute();
  }

  async cancelarChute(): Promise<void> {
    this.aguardando.set(true);
    await this.hub.cancelarChute();
  }

  async enviarChute(): Promise<void> {
    if (!this.chuteTentativa.trim() || this.aguardando()) return;
    this.aguardando.set(true);
    await this.hub.enviarChute(this.chuteTentativa.trim());
  }

  async adicionarTempo(): Promise<void> {
    if (!this.ehMinhavez() || this.aguardando()) return;
    await this.hub.adicionarTempo();
  }

  async forcarAvanco(): Promise<void> {
    await this.hub.avancarMaratona();
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

  letraUsada(letra: string): boolean {
    const letrasUsadas = this.forcaEstado()?.letrasUsadas ?? this.estadoSala()?.letrasUsadas ?? [];
    return letrasUsadas.includes(letra);
  }

  letraErrada(letra: string): boolean {
    const letrasErradas = this.forcaEstado()?.letrasErradas ?? this.estadoSala()?.letrasErradas ?? [];
    return letrasErradas.includes(letra);
  }

  podeInteragirComForca(): boolean {
    return !this.ehEspectador() && this.ehMinhavez() && !this.chuteAberto();
  }

  chuteCompletoValeBonus(): boolean {
    const letrasUsadas = this.forcaEstado()?.letrasUsadas ?? this.estadoSala()?.letrasUsadas ?? [];
    return letrasUsadas.length === 0;
  }

  timerPercent(): number {
    return Math.max(0, Math.min(100, (this.timerSeconds() / this.timerMax()) * 100));
  }

  scorePreview(): number {
    const p = this.perguntaDaVez();
    if (!p) return 0;
    const base = p.dificuldade === 'dificil' ? 3 : p.dificuldade === 'medio' ? 2 : 1;
    return Math.max(0, base + (this.timerSeconds() > 20 ? 1 : 0) - this.addTimeUses());
  }

  nomeModo(tipo: TipoModo | string): string {
    const nomes: Record<string, string> = { quiz: 'Quiz', vof: 'Verdadeiro ou Falso', forca: 'Forca', quemsoueu: 'Quem Sou Eu?' };
    return nomes[tipo] ?? tipo;
  }

  jogarNovamente(): void {
    const equipe = this.minhaEquipe();
    this.voltarParaConfig();
    this.nomeEquipe = equipe || this.nomeEquipe;
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
    this.forcaEstado.set(null);
    this.personagemMimica.set('');
    this.transicaoModo.set(null);
    this.resultadoResposta.set(null);
    this.resultadoLetra.set(null);
    this.resultadoChute.set(null);
    this.feedback.set(null);
    this.aguardando.set(false);
    this.addTimeUses.set(0);
    this.chuteAberto.set(false);
    this.joinUrl.set('');
    this.spectatorUrl.set('');
    this.qrCodeUrl.set('');
    this.shareFeedback.set('');
    this.connectionMessage.set('');
    this.submittedTurn = false;
    if (!manterErro) this.erro.set('');
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
      if (next <= 0 && this.ehMinhavez() && !this.submittedTurn) {
        this.submittedTurn = true;
        const modo = this.modoAtual();
        if (modo === 'quemsoueu') this.hub.responderMimica(false);
        else this.hub.responderMaratona('', 0);
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerId !== null) { window.clearInterval(this.timerId); this.timerId = null; }
  }

  private mapPhase(fase: string): Phase {
    if (fase === 'aguardando') return 'lobby';
    if (fase === 'transicaomodo') return 'transicao-modo';
    if (fase === 'transicaopergunta') return 'transicao';
    if (fase === 'jogando') return 'jogando';
    if (fase === 'encerrada') return 'resultado';
    return 'config';
  }

  private async updateShareLinks(codigoSala: string): Promise<void> {
    const joinUrl = this.roomShare.buildJoinUrl('maratona', codigoSala, 'entrar');
    const spectatorUrl = this.roomShare.buildJoinUrl('maratona', codigoSala, 'assistir');
    this.joinUrl.set(joinUrl);
    this.spectatorUrl.set(spectatorUrl);
    this.qrCodeUrl.set(await this.roomShare.buildQrCode(joinUrl));
  }

  private showShareFeedback(message: string): void {
    this.shareFeedback.set(message);
    window.setTimeout(() => this.shareFeedback.set(''), 2200);
  }
}
