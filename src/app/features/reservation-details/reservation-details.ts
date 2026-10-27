
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { ReservationTab } from './tabs/reservation-tab/reservation-tab';
import { AccrualTab } from './tabs/accrual-tab/accrual-tab';
import { RegistrationFormTab } from './tabs/registration-form-tab/registration-form-tab';
import { ConfirmationTab } from './tabs/confirmation-tab/confirmation-tab';
import { KeyCardsTab } from './tabs/key-cards-tab/key-cards-tab';

type ReservationDetailsTab =
  | 'reservation'
  | 'accrual'
  | 'registration-form'
  | 'confirmation'
  | 'key-cards';

@Component({
  selector: 'app-reservation-details',
  standalone: true,
  imports: [
    MatIconModule,
    ReservationTab,
    AccrualTab,
    RegistrationFormTab,
    ConfirmationTab,
    KeyCardsTab
  ],
  templateUrl: './reservation-details.html',
  styleUrl: './reservation-details.scss'
})
export class ReservationDetails {
  readonly router = inject(Router);

  readonly activeTab = signal<ReservationDetailsTab>('reservation');

  selectTab(tab: ReservationDetailsTab): void {
    this.activeTab.set(tab);
  }
}
