import { Component, inject } from '@angular/core';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatIconModule
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss'
})
export class MainLayout {
  private readonly authService = inject(AuthService);

  protected readonly navItems: NavItem[] = [
    {
      label: 'In House',
      icon: 'home',
      route: '/in-house'
    },
    {
      label: 'Hotel Grid',
      icon: 'calendar_month',
      route: '/hotel-grid'
    },
    {
      label: 'Check-In',
      icon: 'login',
      route: '/reservations/check-in'
    },
    {
      label: 'Check-Out',
      icon: 'logout',
      route: '/reservations/check-out'
    },
    {
      label: 'Search',
      icon: 'search',
      route: '/search'
    },
    {
      label: 'Finance',
      icon: 'account_balance_wallet',
      route: '/finance'
    },
    {
      label: 'Housekeeping',
      icon: 'bed',
      route: '/housekeeping'
    },
    {
      label: 'Reports',
      icon: 'bar_chart',
      route: '/reports'
    },
    {
      label: 'Guests',
      icon: 'group',
      route: '/guests'
    },
    {
      label: 'Settings',
      icon: 'settings',
      route: '/settings'
    }
  ];

  protected onLogout(): void {
    this.authService.logout();
  }
}
