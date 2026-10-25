
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasValidToken()) {
    return true;
  }

  if (!authService.hasRefreshToken()) {
    authService.clearToken();
    return router.createUrlTree(['/login']);
  }

  return authService.refresh().pipe(
    map(() => true),
    catchError(() => {
      authService.clearToken();
      return of(router.createUrlTree(['/login']));
    })
  );
};
