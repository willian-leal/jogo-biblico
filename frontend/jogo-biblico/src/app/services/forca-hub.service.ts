import { Injectable, OnDestroy } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { ConfigService } from './config.service';
import {
  CriarSalaRequest,
  EntradaConfirmadaEvent,
  EstadoSala,
  IniciarRodadaEvent,
  JogadorEntrouEvent,
  JogadorSaiuEvent,
  JogoEncerradoEvent,
  ResultadoChuteEvent,
  ResultadoLetraEvent,
  SalaCriadaEvent
} from '../models/forca-multi.model';

@Injectable({ providedIn: 'root' })
export class ForcaHubService implements OnDestroy {
  private connection: HubConnection | null = null;

  readonly salaCriada$ = new Subject<SalaCriadaEvent>();
  readonly entradaConfirmada$ = new Subject<EntradaConfirmadaEvent>();
  readonly jogadorEntrou$ = new Subject<JogadorEntrouEvent>();
  readonly proximaRodada$ = new Subject<EstadoSala>();
  readonly iniciarRodada$ = new Subject<IniciarRodadaEvent>();
  readonly resultadoLetra$ = new Subject<ResultadoLetraEvent>();
  readonly resultadoChuteAberto$ = new Subject<{ nomeEquipe: string }>();
  readonly resultadoChuteCancelado$ = new Subject<void>();
  readonly resultadoChute$ = new Subject<ResultadoChuteEvent>();
  readonly jogoEncerrado$ = new Subject<JogoEncerradoEvent>();
  readonly jogadorSaiu$ = new Subject<JogadorSaiuEvent>();
  readonly entradaEspectador$ = new Subject<{ estadoSala: EstadoSala }>();
  readonly erroSala$ = new Subject<string>();
  readonly reconectando$ = new Subject<void>();
  readonly reconectado$ = new Subject<void>();
  readonly conexaoFechada$ = new Subject<void>();

  constructor(private config: ConfigService) {}

  async conectar(): Promise<void> {
    if (this.connection?.state === HubConnectionState.Connected) return;

    this.connection = new HubConnectionBuilder()
      .withUrl(`${this.config.apiUrl}/hubs/forca`)
      .withAutomaticReconnect()
      .build();

    this.connection.on('SalaCriada', (e: SalaCriadaEvent) => this.salaCriada$.next(e));
    this.connection.on('EntradaConfirmada', (e: EntradaConfirmadaEvent) => this.entradaConfirmada$.next(e));
    this.connection.on('JogadorEntrou', (e: JogadorEntrouEvent) => this.jogadorEntrou$.next(e));
    this.connection.on('ProximaRodada', (e: EstadoSala) => this.proximaRodada$.next(e));
    this.connection.on('IniciarRodada', (e: IniciarRodadaEvent) => this.iniciarRodada$.next(e));
    this.connection.on('ResultadoLetra', (e: ResultadoLetraEvent) => this.resultadoLetra$.next(e));
    this.connection.on('ChuteAberto', (e: { nomeEquipe: string }) => this.resultadoChuteAberto$.next(e));
    this.connection.on('ChuteCancelado', () => this.resultadoChuteCancelado$.next());
    this.connection.on('ResultadoChute', (e: ResultadoChuteEvent) => this.resultadoChute$.next(e));
    this.connection.on('JogoEncerrado', (e: JogoEncerradoEvent) => this.jogoEncerrado$.next(e));
    this.connection.on('JogadorSaiu', (e: JogadorSaiuEvent) => this.jogadorSaiu$.next(e));
    this.connection.on('EntradaEspectador', (e: { estadoSala: EstadoSala }) => this.entradaEspectador$.next(e));
    this.connection.on('ErroSala', (msg: string) => this.erroSala$.next(msg));
    this.connection.onreconnecting(() => this.reconectando$.next());
    this.connection.onreconnected(() => this.reconectado$.next());
    this.connection.onclose(() => this.conexaoFechada$.next());

    await this.connection.start();
  }

  async desconectar(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }

  async criarSala(req: CriarSalaRequest): Promise<void> {
    await this.connection?.invoke('CriarSala', req);
  }

  async entrarNaSala(codigo: string, nomeEquipe: string): Promise<void> {
    await this.connection?.invoke('EntrarNaSala', codigo, nomeEquipe);
  }

  async iniciarJogo(): Promise<void> {
    await this.connection?.invoke('IniciarJogo');
  }

  async marcarPronto(): Promise<void> {
    await this.connection?.invoke('MarcarPronto');
  }

  async escolherLetra(letra: string): Promise<void> {
    await this.connection?.invoke('EscolherLetra', letra);
  }

  async abrirChute(): Promise<void> {
    await this.connection?.invoke('AbrirChute');
  }

  async cancelarChute(): Promise<void> {
    await this.connection?.invoke('CancelarChute');
  }

  async enviarChute(resposta: string): Promise<void> {
    await this.connection?.invoke('EnviarChute', resposta);
  }

  async avancarRodada(): Promise<void> {
    await this.connection?.invoke('AvancarRodada');
  }

  async entrarComoEspectador(codigo: string): Promise<void> {
    await this.connection?.invoke('EntrarComoEspectador', codigo);
  }

  ngOnDestroy(): void {
    this.desconectar();
  }
}
