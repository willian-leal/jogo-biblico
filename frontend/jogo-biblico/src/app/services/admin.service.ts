import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ConfigService } from './config.service';

export interface AdminAuthResponse {
  token: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export interface AdminReport {
  id: string;
  createdAt: string;
  modo: string;
  perguntaId?: string;
  contexto?: string;
  motivo: string;
  detalhe?: string;
  status: string;
}

export interface AdminSuggestion {
  id: string;
  createdAt: string;
  nome: string;
  contato?: string;
  pergunta: string;
  alternativaA?: string;
  alternativaB?: string;
  alternativaC?: string;
  alternativaD?: string;
  respostaCorreta: string;
  referencia?: string;
  dificuldade: string;
  testamento: string;
  observacao?: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly tokenKey = 'jogo-biblico-admin-token';
  private get api() { return this.config.apiUrl; }

  constructor(private http: HttpClient, private config: ConfigService) {}

  get token(): string {
    return localStorage.getItem(this.tokenKey) ?? '';
  }

  get loggedIn(): boolean {
    return !!this.token;
  }

  login(email: string, password: string): Observable<AdminAuthResponse> {
    return this.http
      .post<AdminAuthResponse>(`${this.api}/auth/login`, { email, password })
      .pipe(tap(res => {
        if (!res.isAdmin) throw new Error('not-admin');
        localStorage.setItem(this.tokenKey, res.token);
      }));
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
  }

  getReports(status = ''): Observable<AdminReport[]> {
    return this.http.get<AdminReport[]>(`${this.api}/admin/reports${status ? `?status=${status}` : ''}`, {
      headers: this.headers()
    });
  }

  updateReportStatus(id: string, status: string): Observable<void> {
    return this.http.patch<void>(`${this.api}/admin/reports/${id}/status`, { status }, {
      headers: this.headers()
    });
  }

  getSuggestions(status = ''): Observable<AdminSuggestion[]> {
    return this.http.get<AdminSuggestion[]>(`${this.api}/admin/suggestions${status ? `?status=${status}` : ''}`, {
      headers: this.headers()
    });
  }

  updateSuggestionStatus(id: string, status: string): Observable<void> {
    return this.http.patch<void>(`${this.api}/admin/suggestions/${id}/status`, { status }, {
      headers: this.headers()
    });
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }
}
