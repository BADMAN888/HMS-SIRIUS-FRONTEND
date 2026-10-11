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
        path: '',
        pathMatch: 'full',
        redirectTo: 'in-house'
      },
      {
        path: 'in-house',
        loadComponent: () =>
          import('./features/reservations/in-house/in-house').then(
            m => m.InHouseComponent
          )
      },
      {
        path: 'hotel-grid',
        loadComponent: () =>
          import('./features/hotel-grid/hotel-grid').then(
            m => m.HotelGrid
          )
      },
      {
        path: 'reservations/check-in',
        loadComponent: () =>
          import('./features/reservations/check-in/check-in').then(
            m => m.CheckIn
          )
      },
      {
        path: 'reservations/check-out',
        loadComponent: () =>
          import('./features/reservations/check-out/check-out').then(
            m => m.CheckOut
          )
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'in-house'
  }
];

