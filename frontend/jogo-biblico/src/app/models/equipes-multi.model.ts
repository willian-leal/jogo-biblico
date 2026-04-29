export interface EquipeMultiEquipes {
  nome: string;
  pontos: number;
}

export interface EstadoSalaEquipes {
  codigoSala: string;
  fase: string;
  equipes: EquipeMultiEquipes[];
  indiceEquipeAtual: number;
  nomeEquipeAtual: string;
  indicePerguntaAtual: number;
  totalPerguntas: number;
  perguntaAtual?: PerguntaDaVezEvent | null;
}

export interface PerguntaDaVezEvent {
  id: string;
  pergunta: string;
  alternativas: string[];
  dificuldade: string;
  referencia: string;
  indicePergunta: number;
}

export interface ResultadoRespostaEvent {
  correta: boolean;
  respostaCorreta: string;
  perguntaTexto: string;
  pontos: number;
  nomeEquipe: string;
  equipes: EquipeMultiEquipes[];
}

export interface CriarSalaEquipesRequest {
  nomeEquipe: string;
  quantidade: number;
  dificuldade?: string;
  testamento?: string;
}

export interface SalaCriadaEquipesEvent {
  codigoSala: string;
  minhaEquipe: string;
  estadoSala: EstadoSalaEquipes;
}

export interface EntradaConfirmadaEquipesEvent {
  minhaEquipe: string;
  estadoSala: EstadoSalaEquipes;
}

export interface JogadorEntrouEquipesEvent {
  nomeEquipe: string;
  equipes: EquipeMultiEquipes[];
}

export interface JogoEncerradoEquipesEvent {
  ranking: EquipeMultiEquipes[];
}

export interface JogadorSaiuEquipesEvent {
  nomeEquipe: string;
  jogoEncerrado: boolean;
  eraAnfitriao: boolean;
}

export interface TempoAdicionadoEquipesEvent {
  nomeEquipe: string;
  addTimeUsesTurno: number;
}
