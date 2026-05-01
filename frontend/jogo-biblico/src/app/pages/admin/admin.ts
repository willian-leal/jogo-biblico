import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminReport, AdminService, AdminSuggestion } from '../../services/admin.service';

type AdminTab = 'reports' | 'suggestions';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.scss'
})
export class Admin implements OnInit {
  email = 'admin@jogodowill.local';
  password = '';
  loginError = '';
  loading = false;
  tab: AdminTab = 'reports';
  reports: AdminReport[] = [];
  suggestions: AdminSuggestion[] = [];
  statusOptions = ['novo', 'em análise', 'corrigido', 'ignorado'];
  suggestionStatusOptions = ['nova', 'em análise', 'aprovada', 'rejeitada'];

  constructor(public admin: AdminService) {}

  ngOnInit() {
    if (this.admin.loggedIn) this.loadAll();
  }

  login() {
    this.loading = true;
    this.loginError = '';
    this.admin.login(this.email, this.password).subscribe({
      next: () => {
        this.loading = false;
        this.loadAll();
      },
      error: () => {
        this.loading = false;
        this.loginError = 'Login inválido ou usuário sem permissão de admin.';
      }
    });
  }

  logout() {
    this.admin.logout();
    this.reports = [];
    this.suggestions = [];
  }

  loadAll() {
    this.admin.getReports().subscribe({ next: reports => this.reports = reports });
    this.admin.getSuggestions().subscribe({ next: suggestions => this.suggestions = suggestions });
  }

  updateReport(report: AdminReport, status: string) {
    this.admin.updateReportStatus(report.id, status).subscribe({
      next: () => report.status = status
    });
  }

  updateSuggestion(suggestion: AdminSuggestion, status: string) {
    this.admin.updateSuggestionStatus(suggestion.id, status).subscribe({
      next: () => suggestion.status = status
    });
  }
}
