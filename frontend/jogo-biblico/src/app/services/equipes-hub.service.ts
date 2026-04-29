import { Injectable, OnDestroy } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { ConfigService } from './config.service';
import {
  CriarSalaEquipesRequest,
  EntradaConfirmadaEquipesEvent,
  EstadoSalaEquipes,
  JogadorEntrouEquipesEvent,
  JogadorSaiuEquipesEvent,
  JogoEncerradoEquipesEvent,
  PerguntaDaVezEvent,
  ResultadoRespostaEvent,
  SalaCriadaEquipesEvent,
  TempoAdicionadoEquipesEvent
} from '../models/equipes-multi.model';

@Injectable({ providedIn: 'root' })
export class EquipesHubService implements OnDestroy {
  private connection: HubConnection | null = null;

  readonly salaCriada$ = new Subject<SalaCriadaEquipesEvent>();
  readonly entradaConfirmada$ = new Subject<EntradaConfirmadaEquipesEvent>();
  readonly jogadorEntrou$ = new Subject<JogadorEntrouEquipesEvent>();
  readonly proximaRodada$ = new Subject<EstadoSalaEquipes>();
  readonly perguntaDaVez$ = new Subject<PerguntaDaVezEvent>();
  readonly aguardandoResposta$ = new Subject<{ estadoSala: EstadoSalaEquipes; nomeEquipe: string }>();
  readonly tempoAdicionado$ = new Subject<TempoAdicionadoEquipesEvent>();
  readonly resultadoResposta$ = new Subject<ResultadoRespostaEvent>();
  readonly jogoEncerrado$ = new Subject<JogoEncerradoEquipesEvent>();
  readonly jogadorSaiu$ = new Subject<JogadorSaiuEquipesEvent>();
  readonly entradaEspectador$ = new Subject<{ estadoSala: EstadoSalaEquipes }>();
  readonly erroSala$ = new Subject<string>();

  constructor(private config: ConfigService) {}

  async conectar(): Promise<void> {
    if (this.connection?.state === HubConnectionState.Connected) return;

    this.connection = new HubConnectionBuilder()
      .withUrl(`${this.config.apiUrl}/hubs/equipes`)
      .withAutomaticReconnect()
      .build();

    this.connection.on('SalaCriada', (e: SalaCriadaEquipesEvent) => this.salaCriada$.next(e));
    this.connection.on('EntradaConfirmada', (e: EntradaConfirmadaEquipesEvent) => this.entradaConfirmada$.next(e));
    this.connection.on('JogadorEntrou', (e: JogadorEntrouEquipesEvent) => this.jogadorEntrou$.next(e));
    this.connection.on('ProximaRodada', (e: EstadoSalaEquipes) => this.proximaRodada$.next(e));
    this.connection.on('PerguntaDaVez', (e: PerguntaDaVezEvent) => this.perguntaDaVez$.next(e));
    this.connection.on('AguardandoResposta', (e: { estadoSala: EstadoSalaEquipes; nomeEquipe: string }) => this.aguardandoResposta$.next(e));
    this.connection.on('TempoAdicionado', (e: TempoAdicionadoEquipesEvent) => this.tempoAdicionado$.next(e));
    this.connection.on('ResultadoResposta', (e: ResultadoRespostaEvent) => this.resultadoResposta$.next(e));
    this.connection.on('JogoEncerrado', (e: JogoEncerradoEquipesEvent) => this.jogoEncerrado$.next(e));
    this.connection.on('JogadorSaiu', (e: JogadorSaiuEquipesEvent) => this.jogadorSaiu$.next(e));
    this.connection.on('EntradaEspectador', (e: { estadoSala: EstadoSalaEquipes }) => this.entradaEspectador$.next(e));
    this.connection.on('ErroSala', (msg: string) => this.erroSala$.next(msg));

    await this.connection.start();
  }

  async desconectar(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }

  async criarSalaEquipes(req: CriarSalaEquipesRequest): Promise<void> {
    await this.connection?.invoke('CriarSalaEquipes', req);
  }

  async entrarNaSalaEquipes(codigo: string, nomeEquipe: string): Promise<void> {
    await this.connection?.invoke('EntrarNaSalaEquipes', codigo, nomeEquipe);
  }

  async iniciarJogoEquipes(): Promise<void> {
    await this.connection?.invoke('IniciarJogoEquipes');
  }

  async marcarProntoEquipes(): Promise<void> {
    await this.connection?.invoke('MarcarProntoEquipes');
  }

  async adicionarTempoEquipes(): Promise<void> {
    await this.connection?.invoke('AdicionarTempoEquipes');
  }

  async responderEquipes(resposta: string, timerSecondsRestante: number): Promise<void> {
    await this.connection?.invoke('ResponderEquipes', resposta, timerSecondsRestante);
  }

  async avancarRodadaEquipes(): Promise<void> {
    await this.connection?.invoke('AvancarRodadaEquipes');
  }

  async entrarComoEspectador(codigo: string): Promise<void> {
    await this.connection?.invoke('EntrarComoEspectadorEquipes', codigo);
  }

  ngOnDestroy(): void {
    this.desconectar();
  }
}
