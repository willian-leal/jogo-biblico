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
    path: 'equipes/multi',
    loadComponent: () => import('./pages/equipes/equipes-multi').then(m => m.EquipesMulti)
  },
  {
    path: 'equipes',
    loadComponent: () => import('./pages/equipes/equipes').then(m => m.Equipes)
  },
  {
    path: 'quem-sou-eu',
    loadComponent: () => import('./pages/quem-sou-eu/quem-sou-eu').then(m => m.QuemSouEu)
  },
  {
    path: 'forca/multi',
    loadComponent: () => import('./pages/forca/forca-multi').then(m => m.ForcaMulti)
  },
  {
    path: 'forca',
    loadComponent: () => import('./pages/forca/forca').then(m => m.Forca)
  },
  {
    path: 'cruzadinha',
    loadComponent: () => import('./pages/cruzadinha/cruzadinha').then(m => m.Cruzadinha)
  },
  { path: '**', redirectTo: '' }
];
