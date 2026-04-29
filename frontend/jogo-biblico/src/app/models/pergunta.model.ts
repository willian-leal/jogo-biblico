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

export interface ForcaPerguntaPublica {
  sessaoId: string;
  indice: number;
  id: string;
  dica: string;
  mascara: string[];
  dificuldade: string;
  testamento?: string;
}

export interface ForcaLetraResponse {
  acertou: boolean;
  mascara: string[];
  finalizada: boolean;
  respostaCorreta?: string;
}

export interface ForcaChuteResponse {
  correta: boolean;
  respostaCorreta: string;
  finalizada: boolean;
}

export type CruzadinhaDirecao = 'horizontal' | 'vertical';

export interface CruzadinhaPalavraPublica {
  id: string;
  numero: number;
  dica: string;
  linha: number;
  coluna: number;
  direcao: CruzadinhaDirecao;
  tamanho: number;
}

export interface CruzadinhaPublica {
  sessaoId: string;
  tamanho: number;
  palavras: CruzadinhaPalavraPublica[];
}

export interface CruzadinhaResposta {
  id: string;
  resposta: string;
}

export interface CruzadinhaVerificarResponse {
  corretas: string[];
  erradas: string[];
  concluida: boolean;
}

export interface RelatarProblemaRequest {
  modo: string;
  perguntaId?: string;
  contexto?: string;
  motivo: string;
  detalhe?: string;
}

export type Dificuldade = 'facil' | 'medio' | 'dificil' | '';
export type Testamento = 'AT' | 'NT' | '';
