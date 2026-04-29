import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ForcaHubService } from '../../services/forca-hub.service';
import { EstadoSala, EquipeMulti } from '../../models/forca-multi.model';

type MultiPhase = 'config' | 'conectando' | 'lobby' | 'transition' | 'playing' | 'result';
type ConfigMode = 'criar' | 'entrar' | 'assistir';

@Component({
  selector: 'app-forca-multi',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forca-multi.html',
  styleUrl: './forca-multi.scss'
})
export class ForcaMulti implements OnInit, OnDestroy {
  phase = signal<MultiPhase>('config');
  configMode = signal<ConfigMode>('criar');

  // Config form
  nomeEquipe = '';
  codigoEntrada = '';
  quantidade = 5;
  dificuldade = '';
  testamento = '';

  // Sala state
  codigoSala = signal('');
  minhaEquipe = signal('');
  ehAnfitriao = signal(false);
  ehEspectador = signal(false);
  estadoSala = signal<EstadoSala | null>(null);
  ranking = signal<EquipeMulti[]>([]);

  // Playing state
  guessing = signal(false);
  chuteAbertoPorEquipe = signal('');
  guess = '';
  feedback = signal<{ type: 'ok' | 'err'; message: string } | null>(null);

  // UI state
  erro = signal('');
  aguardando = signal(false);

  readonly alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  readonly ehMinhavez = computed(
    () => this.estadoSala()?.nomeEquipeAtual === this.minhaEquipe()
  );

  private subs: Subscription[] = [];

  constructor(private hub: ForcaHubService) {}

  async ngOnInit(): Promise<void> {
    this.subs.push(
      this.hub.salaCriada$.subscribe(e => {
        this.codigoSala.set(e.codigoSala);
        this.minhaEquipe.set(e.minhaEquipe);
        this.ehAnfitriao.set(true);
        this.estadoSala.set(e.estadoSala);
        this.phase.set('lobby');
      }),

      this.hub.entradaConfirmada$.subscribe(e => {
        this.minhaEquipe.set(e.minhaEquipe);
        this.estadoSala.set(e.estadoSala);
        this.codigoSala.set(e.estadoSala.codigoSala);
        this.phase.set('lobby');
      }),

      this.hub.jogadorEntrou$.subscribe(e => {
        const sala = this.estadoSala();
        if (!sala) return;
        if (!sala.equipes.find(eq => eq.nome === e.nomeEquipe))
          this.estadoSala.set({ ...sala, equipes: [...sala.equipes, { nome: e.nomeEquipe, pontos: 0 }] });
      }),

      this.hub.proximaRodada$.subscribe(e => {
        this.estadoSala.set(e);
        this.feedback.set(null);
        this.guessing.set(false);
        this.chuteAbertoPorEquipe.set('');
        this.guess = '';
        this.aguardando.set(false);
        this.phase.set('transition');
      }),

      this.hub.iniciarRodada$.subscribe(() => {
        this.aguardando.set(false);
        this.phase.set('playing');
      }),

      this.hub.resultadoLetra$.subscribe(e => {
        this.estadoSala.update(s => s ? {
          ...s,
          equipes: e.equipes,
          letrasUsadas: e.letrasUsadas,
          letrasErradas: e.letrasErradas,
          perguntaAtual: s.perguntaAtual ? { ...s.perguntaAtual, mascara: e.mascara } : null,
          indiceEquipeAtual: e.indiceEquipeAtual,
          nomeEquipeAtual: e.nomeEquipeAtual
        } : s);
        this.aguardando.set(false);

        if (e.finalizada) {
          this.feedback.set({ type: 'ok', message: `Personagem revelado: ${e.respostaCorreta}` });
        } else if (!e.acertou) {
          this.feedback.set({ type: 'err', message: `Não tem "${e.letra}". Vez da ${e.nomeEquipeAtual}.` });
        } else {
          this.feedback.set({ type: 'ok', message: `Letra "${e.letra}" encontrada! +${e.pontos} pontos.` });
        }
      }),

      this.hub.resultadoChuteAberto$.subscribe(e => {
        this.chuteAbertoPorEquipe.set(e.nomeEquipe);
        if (this.ehMinhavez()) this.guessing.set(true);
      }),

      this.hub.resultadoChuteCancelado$.subscribe(() => {
        this.guessing.set(false);
        this.chuteAbertoPorEquipe.set('');
        this.guess = '';
      }),

      this.hub.resultadoChute$.subscribe(e => {
        this.estadoSala.update(s => s ? {
          ...s,
          equipes: e.equipes,
          indiceEquipeAtual: e.indiceEquipeAtual,
          nomeEquipeAtual: e.nomeEquipeAtual
        } : s);
        this.guessing.set(false);
        this.chuteAbertoPorEquipe.set('');
        this.guess = '';
        this.aguardando.set(false);

        if (e.correta) {
          this.feedback.set({ type: 'ok', message: `Acertou! Personagem: ${e.respostaCorreta} +${e.pontos} pontos.` });
        } else {
          this.feedback.set({ type: 'err', message: `Errou! Vez da ${e.nomeEquipeAtual}.` });
        }
      }),

      this.hub.jogoEncerrado$.subscribe(e => {
        this.ranking.set(e.ranking);
        this.phase.set('result');
      }),

      this.hub.entradaEspectador$.subscribe(e => {
        this.ehEspectador.set(true);
        this.estadoSala.set(e.estadoSala);
        this.codigoSala.set(e.estadoSala.codigoSala);
        const fase = e.estadoSala.fase;
        if (fase === 'aguardando') this.phase.set('lobby');
        else if (fase === 'transicao') this.phase.set('transition');
        else if (fase === 'jogando') this.phase.set('playing');
        else if (fase === 'encerrada') this.phase.set('result');
      }),

      this.hub.jogadorSaiu$.subscribe(e => {
        if (e.jogoEncerrado) {
          this.erro.set(e.eraAnfitriao
            ? 'O anfitrião saiu. O jogo foi encerrado.'
            : 'O jogo foi encerrado.');
          this.phase.set('config');
          this.hub.desconectar();
        }
      }),

      this.hub.erroSala$.subscribe(msg => {
        this.erro.set(msg);
        this.aguardando.set(false);
      })
    );
  }

  async criarSala(): Promise<void> {
    if (!this.nomeEquipe.trim()) { this.erro.set('Informe o nome da sua equipe.'); return; }
    this.erro.set('');
    this.phase.set('conectando');
    try {
      await this.hub.conectar();
      await this.hub.criarSala({
        nomeEquipe: this.nomeEquipe.trim(),
        quantidade: this.quantidade,
        dificuldade: this.dificuldade || undefined,
        testamento: this.testamento || undefined
      });
    } catch {
      this.erro.set('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
      this.phase.set('config');
    }
  }

  async entrarComoEspectador(): Promise<void> {
    if (!this.codigoEntrada.trim()) { this.erro.set('Informe o código da sala.'); return; }
    this.erro.set('');
    this.phase.set('conectando');
    try {
      await this.hub.conectar();
      await this.hub.entrarComoEspectador(this.codigoEntrada.trim());
    } catch {
      this.erro.set('Não foi possível conectar ao servidor.');
      this.phase.set('config');
    }
  }

  async entrarNaSala(): Promise<void> {
    if (!this.codigoEntrada.trim()) { this.erro.set('Informe o código da sala.'); return; }
    if (!this.nomeEquipe.trim()) { this.erro.set('Informe o nome da sua equipe.'); return; }
    this.erro.set('');
    this.phase.set('conectando');
    try {
      await this.hub.conectar();
      await this.hub.entrarNaSala(this.codigoEntrada.trim(), this.nomeEquipe.trim());
    } catch {
      this.erro.set('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
      this.phase.set('config');
    }
  }

  async iniciarJogo(): Promise<void> {
    this.erro.set('');
    await this.hub.iniciarJogo();
  }

  async marcarPronto(): Promise<void> {
    this.aguardando.set(true);
    await this.hub.marcarPronto();
  }

  async escolherLetra(letra: string): Promise<void> {
    if (this.aguardando()) return;
    this.aguardando.set(true);
    await this.hub.escolherLetra(letra);
  }

  async abrirChute(): Promise<void> {
    await this.hub.abrirChute();
  }

  async cancelarChute(): Promise<void> {
    await this.hub.cancelarChute();
  }

  async enviarChute(): Promise<void> {
    if (!this.guess.trim() || this.aguardando()) return;
    this.aguardando.set(true);
    await this.hub.enviarChute(this.guess.trim());
  }

  async forcarAvanco(): Promise<void> {
    await this.hub.avancarRodada();
  }

  isLetterUsed(letra: string): boolean {
    return this.estadoSala()?.letrasUsadas?.includes(letra) ?? false;
  }

  isLetterWrong(letra: string): boolean {
    return this.estadoSala()?.letrasErradas?.includes(letra) ?? false;
  }

  voltarParaConfig(): void {
    this.hub.desconectar();
    this.phase.set('config');
    this.estadoSala.set(null);
    this.codigoSala.set('');
    this.minhaEquipe.set('');
    this.ehAnfitriao.set(false);
    this.ehEspectador.set(false);
    this.ranking.set([]);
    this.feedback.set(null);
    this.erro.set('');
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.hub.desconectar();
  }
}
