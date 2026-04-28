import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then(m => m.Home)
  },
  {
    path: 'quiz',
    loadComponent: () => import('./pages/quiz/quiz').then(m => m.Quiz)
  },
  {
    path: 'flashcard',
    loadComponent: () => import('./pages/flashcard/flashcard').then(m => m.Flashcard)
  },
  {
    path: 'vof',
    loadComponent: () => import('./pages/vof/vof').then(m => m.Vof)
  },
  {
    path: 'equipes',
    loadComponent: () => import('./pages/equipes/equipes').then(m => m.Equipes)
  },
  { path: '**', redirectTo: '' }
];
