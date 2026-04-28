export interface PerguntaPublica {
  id: string;
  pergunta: string;
  referencia: string;
  testamento: string;
  dificuldade: string;
  alternativas: string[];
}

export interface VerificarResponse {
  correta: boolean;
  respostaCorreta: string;
}

export interface VofPerguntaPublica {
  sessaoId: string;
  indice: number;
  id: string;
  afirmacao: string;
}

export interface VofVerificarResponse {
  correta: boolean;
  gabarito: 'verdadeiro' | 'falso';
}

export type Dificuldade = 'facil' | 'medio' | 'dificil' | '';
export type Testamento = 'AT' | 'NT' | '';
