import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then(
        m => m.Login
      )
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/main-layout/main-layout').then(
        m => m.MainLayout
      ),
    children: [
      {
        path: 'in-house-guests',
        loadComponent: () =>
          import('./features/in-house-guests/in-house-guests').then(
            m => m.InHouseGuests
          )
      },
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
