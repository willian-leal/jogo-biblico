import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  PerguntaPublica,
  VerificarResponse,
  VofPerguntaPublica,
  VofVerificarResponse
} from '../models/pergunta.model';

@Injectable({ providedIn: 'root' })
export class PerguntaService {
  private readonly api = 'http://localhost:5000';

  constructor(private http: HttpClient) {}

  getPerguntas(quantidade: number, dificuldade?: string, testamento?: string): Observable<PerguntaPublica[]> {
    let params = new HttpParams().set('quantidade', quantidade);
    if (dificuldade) params = params.set('dificuldade', dificuldade);
    if (testamento) params = params.set('testamento', testamento);
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
    testamento?: string
  ): Observable<VofPerguntaPublica[]> {
    let params = new HttpParams().set('quantidade', quantidade);
    if (dificuldade) params = params.set('dificuldade', dificuldade);
    if (testamento) params = params.set('testamento', testamento);
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
