import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
export class ReservationDetails implements OnInit {
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly guestProfileWorkflow = inject(GuestProfileWorkflowService);
  private currentReservationId: string | null = null;

  readonly activeTab = signal<ReservationDetailsTab>('reservation');
  readonly profileToSelect = signal<number | null>(null);

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const reservationId = params.get('id');
      if (this.currentReservationId !== null && reservationId !== this.currentReservationId) {
        this.activeTab.set('reservation');
        this.profileToSelect.set(null);
      }
      this.currentReservationId = reservationId;
    });
  }

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

  openGuestProfile(profileId: number): void {
    this.profileToSelect.set(profileId);
    this.activeTab.set('profiles');
  }
}
