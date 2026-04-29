import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfigService } from './config.service';
import {
  CruzadinhaPublica,
  CruzadinhaResposta,
  CruzadinhaVerificarResponse,
  ForcaChuteResponse,
  ForcaLetraResponse,
  ForcaPerguntaPublica,
  PerguntaPublica,
  RelatarProblemaRequest,
  VerificarResponse,
  VofPerguntaPublica,
  VofVerificarResponse
} from '../models/pergunta.model';

@Injectable({ providedIn: 'root' })
export class PerguntaService {
  private get api() { return this.config.apiUrl; }

  constructor(private http: HttpClient, private config: ConfigService) {}

  getPerguntas(
    quantidade: number,
    dificuldade?: string,
    testamento?: string,
    personagem?: boolean
  ): Observable<PerguntaPublica[]> {
    let params = new HttpParams().set('quantidade', quantidade);
    if (dificuldade) params = params.set('dificuldade', dificuldade);
    if (testamento) params = params.set('testamento', testamento);
    if (personagem !== undefined) params = params.set('personagem', personagem);
    return this.http
      .get<PerguntaPublica[]>(`${this.api}/perguntas/aleatorio`, { params })
      .pipe(map(perguntas => perguntas.map(pergunta => this.formatPergunta(pergunta))));
  }

  verificarResposta(id: string, resposta: string): Observable<VerificarResponse> {
    return this.http
      .post<VerificarResponse>(`${this.api}/perguntas/verificar`, { id, resposta })
      .pipe(
        map(resultado => ({
          ...resultado,
          respostaCorreta: this.toSentenceCase(resultado.respostaCorreta)
        }))
      );
  }

  getVerdadeiroOuFalso(
    quantidade: number,
    dificuldade?: string,
    testamento?: string,
    personagem?: boolean
  ): Observable<VofPerguntaPublica[]> {
    let params = new HttpParams().set('quantidade', quantidade);
    if (dificuldade) params = params.set('dificuldade', dificuldade);
    if (testamento) params = params.set('testamento', testamento);
    if (personagem !== undefined) params = params.set('personagem', personagem);
    return this.http
      .get<VofPerguntaPublica[]>(`${this.api}/perguntas/vof`, { params })
      .pipe(
        map(perguntas =>
          perguntas.map(pergunta => ({
            ...pergunta,
            afirmacao: this.toSentenceCase(pergunta.afirmacao)
          }))
        )
      );
  }

  verificarVerdadeiroOuFalso(
    sessaoId: string,
    indice: number,
    resposta: 'verdadeiro' | 'falso'
  ): Observable<VofVerificarResponse> {
    return this.http.post<VofVerificarResponse>(`${this.api}/perguntas/vof/verificar`, {
      sessaoId,
      indice,
      resposta
    });
  }

  getForca(
    quantidade: number,
    dificuldade?: string,
    testamento?: string
  ): Observable<ForcaPerguntaPublica[]> {
    let params = new HttpParams().set('quantidade', quantidade);
    if (dificuldade) params = params.set('dificuldade', dificuldade);
    if (testamento) params = params.set('testamento', testamento);
    return this.http
      .get<ForcaPerguntaPublica[]>(`${this.api}/perguntas/forca`, { params })
      .pipe(
        map(perguntas =>
          perguntas.map(pergunta => ({
            ...pergunta,
            dica: this.toSentenceCase(pergunta.dica)
          }))
        )
      );
  }

  verificarLetraForca(
    sessaoId: string,
    indice: number,
    letra: string
  ): Observable<ForcaLetraResponse> {
    return this.http.post<ForcaLetraResponse>(`${this.api}/perguntas/forca/letra`, {
      sessaoId,
      indice,
      letra
    });
  }

  chutarForca(
    sessaoId: string,
    indice: number,
    resposta: string
  ): Observable<ForcaChuteResponse> {
    return this.http.post<ForcaChuteResponse>(`${this.api}/perguntas/forca/chute`, {
      sessaoId,
      indice,
      resposta
    });
  }

  getCruzadinha(
    quantidade?: number,
    dificuldade?: string,
    testamento?: string
  ): Observable<CruzadinhaPublica> {
    let params = new HttpParams();
    if (quantidade) params = params.set('quantidade', quantidade);
    if (dificuldade) params = params.set('dificuldade', dificuldade);
    if (testamento) params = params.set('testamento', testamento);
    return this.http
      .get<CruzadinhaPublica>(`${this.api}/perguntas/cruzadinha`, { params })
      .pipe(
        map(cruzadinha => ({
          ...cruzadinha,
          palavras: cruzadinha.palavras.map(palavra => ({
            ...palavra,
            dica: this.toSentenceCase(palavra.dica)
          }))
        }))
      );
  }

  verificarCruzadinha(
    sessaoId: string,
    respostas: CruzadinhaResposta[]
  ): Observable<CruzadinhaVerificarResponse> {
    return this.http.post<CruzadinhaVerificarResponse>(`${this.api}/perguntas/cruzadinha/verificar`, {
      sessaoId,
      respostas
    });
  }

  relatarProblema(payload: RelatarProblemaRequest): Observable<void> {
    return this.http.post<void>(`${this.api}/perguntas/relatar-problema`, payload);
  }

  private formatPergunta(pergunta: PerguntaPublica): PerguntaPublica {
    return {
      ...pergunta,
      pergunta: this.toSentenceCase(pergunta.pergunta),
      alternativas: pergunta.alternativas.map(alternativa => this.toSentenceCase(alternativa))
    };
  }

  private toSentenceCase(value: string): string {
    const text = `${value ?? ''}`.replace(/\s+/g, ' ').trim();
    if (!text) return text;

    const lower = text.toLocaleLowerCase('pt-BR');
    const chars = [...lower];
    const firstLetterIndex = chars.findIndex(
      char => char.toLocaleUpperCase('pt-BR') !== char.toLocaleLowerCase('pt-BR')
    );
    if (firstLetterIndex < 0) return lower;

    chars[firstLetterIndex] = chars[firstLetterIndex].toLocaleUpperCase('pt-BR');
    return chars.join('');
  }
}
