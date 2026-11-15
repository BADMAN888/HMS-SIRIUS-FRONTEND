import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import {
  GuestProfileDraftIntent,
  GuestProfileWorkflowService
} from '../../core/services/guest-profile-workflow.service';

import { ReservationTab } from './tabs/reservation-tab/reservation-tab';
import { ProfilesTab } from './tabs/profiles-tab/profiles-tab';
import { AccrualTab } from './tabs/accrual-tab/accrual-tab';
import { RegistrationFormTab } from './tabs/registration-form-tab/registration-form-tab';
import { ConfirmationTab } from './tabs/confirmation-tab/confirmation-tab';
import { KeyCardsTab } from './tabs/key-cards-tab/key-cards-tab';

type ReservationDetailsTab =
  | 'reservation'
  | 'profiles'
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
    ProfilesTab,
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
  private readonly guestProfileWorkflow = inject(GuestProfileWorkflowService);

  readonly activeTab = signal<ReservationDetailsTab>('reservation');

  selectTab(tab: ReservationDetailsTab): void {
    this.activeTab.set(tab);
  }

  createGuestProfile(
    intent: Omit<GuestProfileDraftIntent, 'requestId' | 'returnToReservation'>
  ): void {
    this.guestProfileWorkflow.start(intent);
    this.activeTab.set('profiles');
  }

  returnToReservation(): void {
    this.activeTab.set('reservation');
  }
}
