export interface EquipeMulti {
  nome: string;
  pontos: number;
}

export interface PerguntaAtualMulti {
  id: string;
  dica: string;
  mascara: string[];
  dificuldade: string;
}

export interface EstadoSala {
  codigoSala: string;
  fase: 'aguardando' | 'transicao' | 'jogando' | 'encerrada';
  equipes: EquipeMulti[];
  indiceEquipeAtual: number;
  nomeEquipeAtual: string;
  indicePerguntaAtual: number;
  totalPerguntas: number;
  perguntaAtual: PerguntaAtualMulti | null;
  letrasUsadas: string[];
  letrasErradas: string[];
}

export interface SalaCriadaEvent {
  codigoSala: string;
  minhaEquipe: string;
  estadoSala: EstadoSala;
}

export interface EntradaConfirmadaEvent {
  minhaEquipe: string;
  estadoSala: EstadoSala;
}

export interface JogadorEntrouEvent {
  nomeEquipe: string;
  totalEquipes: number;
}

export interface IniciarRodadaEvent {
  indicePergunta: number;
  totalPerguntas: number;
  indiceEquipe: number;
  nomeEquipe: string;
}

export interface ResultadoLetraEvent {
  letra: string;
  acertou: boolean;
  mascara: string[];
  finalizada: boolean;
  respostaCorreta?: string;
  pontos: number;
  equipes: EquipeMulti[];
  letrasUsadas: string[];
  letrasErradas: string[];
  indiceEquipeAtual: number;
  nomeEquipeAtual: string;
}

export interface ResultadoChuteEvent {
  correta: boolean;
  respostaCorreta: string;
  pontos: number;
  equipes: EquipeMulti[];
  indiceEquipeAtual: number;
  nomeEquipeAtual: string;
}

export interface JogadorSaiuEvent {
  nomeEquipe: string;
  eraAnfitriao: boolean;
  jogoEncerrado: boolean;
}

export interface JogoEncerradoEvent {
  ranking: EquipeMulti[];
}

export interface CriarSalaRequest {
  nomeEquipe: string;
  quantidade: number;
  dificuldade?: string;
  testamento?: string;
}
