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
    path: 'chantier-details/:id', // 👈 Le ":id" est crucial
    loadComponent: () => import('./pages/chantier-details/chantier-details.page').then( m => m.ChantierDetailsPage), canActivate: [authGuard]
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
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then( m => m.LoginPage)
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.page').then( m => m.SettingsPage),  canActivate: [authGuard]
  },
  {
    path: 'planning',
    loadComponent: () => import('./pages/planning/planning.page').then( m => m.PlanningPage), canActivate: [authGuard]
  },
  {
    path: 'company',
    loadComponent: () => import('./pages/company/company.page').then( m => m.CompanyPage), canActivate: [authGuard]
  },
  {
    path: 'pdp-form',
    loadComponent: () => import('./pages/pdp-form/pdp-form.page').then( m => m.PdpFormPage)
  },
  {
    path: 'pdp-form/:id',
    loadComponent: () => import('./pages/pdp-form/pdp-form.page').then( m => m.PdpFormPage)
  },
  {
    path: 'team',
    loadComponent: () => import('./pages/team/team.page').then( m => m.TeamPage), canActivate: [authGuard]
  },
  {
    path: 'pic-form',
    loadComponent: () => import('./pages/pic-form/pic-form.page').then( m => m.PicFormPage)
  },
  {
    path: 'duerp-form',
    loadComponent: () => import('./pages/company/duerp-form/duerp-form.page').then( m => m.DuerpFormPage)
  },
  {
    path: 'permis-feu-modal',
    loadComponent: () => import('./pages/tasks/permis-feu-modal/permis-feu-modal.page').then( m => m.PermisFeuModalPage)
  },
  {
    path: 'securite-doc',
    loadComponent: () => import('./securite-doc/securite-doc.page').then( m => m.SecuriteDocPage), canActivate: [authGuard]
  }
];