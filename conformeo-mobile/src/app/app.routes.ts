import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'materiel',
    loadComponent: () => import('./pages/materiel/materiel.page').then( m => m.MaterielPage)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.page').then( m => m.DashboardPage)
  },
  {
    path: 'chantier/:id',
    loadComponent: () => import('./pages/chantier-details/chantier-details.page').then( m => m.ChantierDetailsPage)
  },
  {
    path: 'qhse-form/:id',
    loadComponent: () => import('./pages/qhse-form/qhse-form.page').then( m => m.QhseFormPage)
  },
  {
    path: 'ppsps-form/:id',
    loadComponent: () => import('./pages/ppsps-form/ppsps-form.page').then( m => m.PpspsFormPage)
  },
  {
    path: 'smart-scan/:id',
    loadComponent: () => import('./pages/smart-scan/smart-scan.page').then( m => m.SmartScanPage)
  },
  {
    path: 'equipe',
    loadComponent: () => import('./pages/equipe/equipe.page').then( m => m.EquipePage)
  },
  {
    path: 'equipe',
    loadComponent: () => import('./pages/equipe/equipe.page').then( m => m.EquipePage)
  },
];