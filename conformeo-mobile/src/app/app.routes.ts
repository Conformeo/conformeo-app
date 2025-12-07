import { Routes } from '@angular/router';
import { authGuard } from '../app/guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage), canActivate: [authGuard]
  },
  {
    path: 'materiel',
    loadComponent: () => import('./pages/materiel/materiel.page').then( m => m.MaterielPage), canActivate: [authGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.page').then( m => m.DashboardPage), canActivate: [authGuard]
  },
  {
    path: 'chantier/:id',
    loadComponent: () => import('./pages/chantier-details/chantier-details.page').then( m => m.ChantierDetailsPage), canActivate: [authGuard]
  },
  {
    path: 'qhse-form/:id',
    loadComponent: () => import('./pages/qhse-form/qhse-form.page').then( m => m.QhseFormPage), canActivate: [authGuard]
  },
  {
    path: 'ppsps-form/:id',
    loadComponent: () => import('./pages/ppsps-form/ppsps-form.page').then( m => m.PpspsFormPage), canActivate: [authGuard]
  },
  {
    path: 'smart-scan/:id',
    loadComponent: () => import('./pages/smart-scan/smart-scan.page').then( m => m.SmartScanPage), canActivate: [authGuard]
  },
  {
    path: 'equipe',
    loadComponent: () => import('./pages/equipe/equipe.page').then( m => m.EquipePage), canActivate: [authGuard]
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then( m => m.LoginPage)
  },
  {
    path: 'parametres',
    loadComponent: () => import('./pages/parametres/parametres.page').then( m => m.ParametresPage),
    canActivate: [authGuard]
  },
  {
    path: 'planning',
    loadComponent: () => import('./pages/planning/planning.page').then( m => m.PlanningPage)
  },
];