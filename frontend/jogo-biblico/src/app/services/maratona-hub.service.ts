import { Injectable, OnDestroy } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { ConfigService } from './config.service';
import {
  CriarSalaMaratonaRequest,
  EntradaConfirmadaMaratonaEvent,
  EstadoSalaMaratona,
  ForcaIniciadaEvent,
  JogadorEntrouMaratonaEvent,
  PerguntaMaratonaEvent,
  ResultadoChuteMaratonaEvent,
  ResultadoLetraEvent,
  ResultadoMimicaEvent,
  ResultadoRespostaMaratonaEvent,
  SalaCriadaMaratonaEvent,
  TempoAdicionadoMaratonaEvent,
  TransicaoModoEvent
} from '../models/maratona.model';

@Injectable({ providedIn: 'root' })
export class MaratonaHubService implements OnDestroy {
  private connection: HubConnection | null = null;

  readonly salaCriada$ = new Subject<SalaCriadaMaratonaEvent>();
  readonly entradaConfirmada$ = new Subject<EntradaConfirmadaMaratonaEvent>();
  readonly jogadorEntrou$ = new Subject<JogadorEntrouMaratonaEvent>();
  readonly entradaEspectador$ = new Subject<{ estadoSala: EstadoSalaMaratona }>();
  readonly proximaRodada$ = new Subject<EstadoSalaMaratona>();
  readonly perguntaDaVez$ = new Subject<PerguntaMaratonaEvent>();
  readonly forcaIniciada$ = new Subject<ForcaIniciadaEvent>();
  readonly personagemParaMimar$ = new Subject<{ personagem: string; indicePergunta: number }>();
  readonly mimicaIniciada$ = new Subject<{ nomeEquipeAtual: string; indicePergunta: number }>();
  readonly resultadoResposta$ = new Subject<ResultadoRespostaMaratonaEvent>();
  readonly resultadoMimica$ = new Subject<ResultadoMimicaEvent>();
  readonly resultadoLetra$ = new Subject<ResultadoLetraEvent>();
  readonly chuteAberto$ = new Subject<{ nomeEquipe: string }>();
  readonly chuteCancelado$ = new Subject<void>();
  readonly resultadoChute$ = new Subject<ResultadoChuteMaratonaEvent>();
  readonly tempoAdicionado$ = new Subject<TempoAdicionadoMaratonaEvent>();
  readonly transicaoModo$ = new Subject<TransicaoModoEvent>();
  readonly maratonaEncerrada$ = new Subject<{ ranking: { nome: string; pontos: number }[] }>();
  readonly jogadorSaiu$ = new Subject<{ nomeEquipe: string; eraAnfitriao: boolean; jogoEncerrado: boolean }>();
  readonly erroSala$ = new Subject<string>();
  readonly reconectando$ = new Subject<void>();
  readonly reconectado$ = new Subject<void>();
  readonly conexaoFechada$ = new Subject<void>();

  constructor(private config: ConfigService) {}

  async conectar(): Promise<void> {
    if (this.connection?.state === HubConnectionState.Connected) return;

    this.connection = new HubConnectionBuilder()
      .withUrl(`${this.config.apiUrl}/hubs/maratona`)
      .withAutomaticReconnect()
      .build();

    this.connection.on('SalaCriada', (e: SalaCriadaMaratonaEvent) => this.salaCriada$.next(e));
    this.connection.on('EntradaConfirmada', (e: EntradaConfirmadaMaratonaEvent) => this.entradaConfirmada$.next(e));
    this.connection.on('JogadorEntrou', (e: JogadorEntrouMaratonaEvent) => this.jogadorEntrou$.next(e));
    this.connection.on('EntradaEspectador', (e: { estadoSala: EstadoSalaMaratona }) => this.entradaEspectador$.next(e));
    this.connection.on('ProximaRodada', (e: EstadoSalaMaratona) => this.proximaRodada$.next(e));
    this.connection.on('PerguntaDaVez', (e: PerguntaMaratonaEvent) => this.perguntaDaVez$.next(e));
    this.connection.on('ForcaIniciada', (e: ForcaIniciadaEvent) => this.forcaIniciada$.next(e));
    this.connection.on('PersonagemParaMimar', (e: { personagem: string; indicePergunta: number }) => this.personagemParaMimar$.next(e));
    this.connection.on('MimicaIniciada', (e: { nomeEquipeAtual: string; indicePergunta: number }) => this.mimicaIniciada$.next(e));
    this.connection.on('ResultadoResposta', (e: ResultadoRespostaMaratonaEvent) => this.resultadoResposta$.next(e));
    this.connection.on('ResultadoMimica', (e: ResultadoMimicaEvent) => this.resultadoMimica$.next(e));
    this.connection.on('ResultadoLetra', (e: ResultadoLetraEvent) => this.resultadoLetra$.next(e));
    this.connection.on('ChuteAberto', (e: { nomeEquipe: string }) => this.chuteAberto$.next(e));
    this.connection.on('ChuteCancelado', () => this.chuteCancelado$.next());
    this.connection.on('ResultadoChute', (e: ResultadoChuteMaratonaEvent) => this.resultadoChute$.next(e));
    this.connection.on('TempoAdicionado', (e: TempoAdicionadoMaratonaEvent) => this.tempoAdicionado$.next(e));
    this.connection.on('TransicaoModo', (e: TransicaoModoEvent) => this.transicaoModo$.next(e));
    this.connection.on('MaratonaEncerrada', (e: { ranking: { nome: string; pontos: number }[] }) => this.maratonaEncerrada$.next(e));
    this.connection.on('JogadorSaiu', (e: { nomeEquipe: string; eraAnfitriao: boolean; jogoEncerrado: boolean }) => this.jogadorSaiu$.next(e));
    this.connection.on('ErroSala', (msg: string) => this.erroSala$.next(msg));
    this.connection.onreconnecting(() => this.reconectando$.next());
    this.connection.onreconnected(() => this.reconectado$.next());
    this.connection.onclose(() => this.conexaoFechada$.next());

    await this.connection.start();
  }

  async desconectar(): Promise<void> {
    if (this.connection) { await this.connection.stop(); this.connection = null; }
  }

  async criarSalaMaratona(req: CriarSalaMaratonaRequest): Promise<void> {
    await this.connection?.invoke('CriarSalaMaratona', req);
  }

  async entrarNaSalaMaratona(codigo: string, nomeEquipe: string): Promise<void> {
    await this.connection?.invoke('EntrarNaSalaMaratona', codigo, nomeEquipe);
  }

  async entrarComoEspectador(codigo: string): Promise<void> {
    await this.connection?.invoke('EntrarComoEspectadorMaratona', codigo);
  }

  async iniciarMaratona(): Promise<void> {
    await this.connection?.invoke('IniciarMaratona');
  }

  async iniciarProximoModo(): Promise<void> {
    await this.connection?.invoke('IniciarProximoModo');
  }

  async marcarProntoMaratona(): Promise<void> {
    await this.connection?.invoke('MarcarProntoMaratona');
  }

  async responderMaratona(resposta: string, timerSeconds: number): Promise<void> {
    await this.connection?.invoke('ResponderMaratona', resposta, timerSeconds);
  }

  async responderMimica(acertou: boolean): Promise<void> {
    await this.connection?.invoke('ResponderMimica', acertou);
  }

  async escolherLetraForca(letra: string): Promise<void> {
    await this.connection?.invoke('EscolherLetraForca', letra);
  }

  async abrirChute(): Promise<void> {
    await this.connection?.invoke('AbrirChuteMaratona');
  }

  async cancelarChute(): Promise<void> {
    await this.connection?.invoke('CancelarChuteMaratona');
  }

  async enviarChute(resposta: string): Promise<void> {
    await this.connection?.invoke('EnviarChuteMaratona', resposta);
  }

  async adicionarTempo(): Promise<void> {
    await this.connection?.invoke('AdicionarTempoMaratona');
  }

  async avancarMaratona(): Promise<void> {
    await this.connection?.invoke('AvancarMaratona');
  }

  ngOnDestroy(): void { this.desconectar(); }
}
