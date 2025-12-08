import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService } from '../services/api';

export const authGuard: CanActivateFn = async (route, state) => {
  const api = inject(ApiService);
  const router = inject(Router);

  // 👇 On attend la réponse (await)
  const isAuth = await api.isAuthenticated();

  if (isAuth) {
    return true;
  } else {
    // Si pas connecté, on redirige vers Login
    router.navigate(['/login']);
    return false;
  }
};