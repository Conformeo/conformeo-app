import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService } from '../services/api';

export const authGuard: CanActivateFn = (route, state) => {
  const api = inject(ApiService);
  const router = inject(Router);

  if (api.isAuthenticated()) {
    return true; // C'est bon, on laisse passer
  } else {
    router.navigate(['/login']); // Dehors !
    return false;
  }
};