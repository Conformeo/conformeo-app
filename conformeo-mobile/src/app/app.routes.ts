import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    // C'est la nouvelle route dynamique
    path: 'chantier/:id',
    loadComponent: () => import('./pages/chantier-details/chantier-details.page').then( m => m.ChantierDetailsPage)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.page').then( m => m.DashboardPage)
  },
  {
    path: 'materiel',
    loadComponent: () => import('./pages/materiel/materiel.page').then( m => m.MaterielPage)
  },
];