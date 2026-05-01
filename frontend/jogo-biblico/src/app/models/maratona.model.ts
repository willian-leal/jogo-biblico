export type TipoModo = 'quiz' | 'vof' | 'forca' | 'quemsoueu';

export interface ModoConfig {
  tipo: TipoModo;
  quantidadePorEquipe: number;
  dificuldade?: string;
  testamento?: string;
}

export interface EquipeMaratona {
  nome: string;
  pontos: number;
}

export interface EstadoSalaMaratona {
  codigoSala: string;
  fase: string;
  modoAtual: TipoModo | '';
  indiceModosAtual: number;
  totalModos: number;
  modos: { tipo: TipoModo; quantidadePorEquipe: number }[];
  equipes: EquipeMaratona[];
  indiceEquipeAtual: number;
  nomeEquipeAtual: string;
  indicePerguntaAtual: number;
  totalPerguntasDoModo: number;
  mascara?: string[];
  letrasUsadas?: string[];
  letrasErradas?: string[];
  dica?: string;
  perguntaAtual?: PerguntaMaratonaEvent | null;
}

export interface SalaCriadaMaratonaEvent {
  codigoSala: string;
  minhaEquipe: string;
  estadoSala: EstadoSalaMaratona;
}

export interface EntradaConfirmadaMaratonaEvent {
  minhaEquipe: string;
  estadoSala: EstadoSalaMaratona;
}

export interface JogadorEntrouMaratonaEvent {
  nomeEquipe: string;
  equipes: EquipeMaratona[];
}

export interface PerguntaMaratonaEvent {
  id: string;
  pergunta: string;
  alternativas: string[];
  dificuldade: string;
  referencia: string;
  indicePergunta: number;
}

export interface ForcaIniciadaEvent {
  dica: string;
  mascara: string[];
  letrasUsadas: string[];
  letrasErradas: string[];
  dificuldade: string;
  referencia: string;
  indicePergunta: number;
  nomeEquipeAtual: string;
}

export interface ResultadoLetraEvent {
  letra: string;
  acertou: boolean;
  mascara: string[];
  finalizada: boolean;
  respostaCorreta: string | null;
  pontos: number;
  equipes: EquipeMaratona[];
  letrasUsadas: string[];
  letrasErradas: string[];
  indiceEquipeAtual: number;
  nomeEquipeAtual: string;
}

export interface ResultadoRespostaMaratonaEvent {
  correta: boolean;
  respostaCorreta: string;
  perguntaTexto: string;
  pontos: number;
  nomeEquipe: string;
  equipes: EquipeMaratona[];
}

export interface ResultadoMimicaEvent {
  acertou: boolean;
  personagem: string;
  pontos: number;
  nomeEquipe: string;
  equipes: EquipeMaratona[];
}

export interface ResultadoChuteMaratonaEvent {
  correta: boolean;
  respostaCorreta: string;
  pontos: number;
  equipes: EquipeMaratona[];
  indiceEquipeAtual: number;
  nomeEquipeAtual: string;
}

export interface TransicaoModoEvent {
  ranking: EquipeMaratona[];
  proximoModo: TipoModo;
  indiceModosAtual: number;
  totalModos: number;
}

export interface TempoAdicionadoMaratonaEvent {
  addTimeUsesTurno: number;
  nomeEquipe: string;
}

export interface CriarSalaMaratonaRequest {
  nomeEquipe: string;
  modos: { tipo: string; quantidadePorEquipe: number; dificuldade?: string; testamento?: string }[];
}
