import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe } from '@angular/common';
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
import { ReservationService } from '../../core/services/reservation.service';
import { ReservationHistoryResponse } from '../../core/models/reservation/reservation-history-response.model';

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
    DatePipe,
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
  private readonly reservationService = inject(ReservationService);
  private currentReservationId: string | null = null;

  readonly activeTab = signal<ReservationDetailsTab>('reservation');
  readonly profileToSelect = signal<number | null>(null);
  readonly historyOpen = signal(false);
  readonly historyLoading = signal(false);
  readonly historyError = signal(false);
  readonly history = signal<ReservationHistoryResponse[]>([]);

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const reservationId = params.get('id');
      if (this.currentReservationId !== null && reservationId !== this.currentReservationId) {
        this.activeTab.set('reservation');
        this.profileToSelect.set(null);
      }
      this.currentReservationId = reservationId;
      this.historyOpen.set(false);
    });
  }

  openHistory(): void {
    const id = Number(this.currentReservationId);
    if (!Number.isInteger(id) || id <= 0) return;
    this.historyOpen.set(true);
    this.historyLoading.set(true);
    this.historyError.set(false);
    this.reservationService.getHistory(id).subscribe({
      next: items => { this.history.set(items); this.historyLoading.set(false); },
      error: () => { this.historyError.set(true); this.historyLoading.set(false); }
    });
  }

  closeHistory(): void { this.historyOpen.set(false); }

  historyField(field: string): string {
    const labels: Record<string, string> = {
      reservation: 'Бронювання', checkIn: 'Заїзд', checkOut: 'Виїзд', room: 'Номер',
      adults: 'Дорослі', children: 'Діти', guestName: 'Ім’я гостя', guestPhone: 'Телефон',
      guestEmail: 'Email', roomLocked: 'Закріплення номера', taxStatus: 'Податковий статус',
      externalBookingNumber: 'Зовнішній номер бронювання', bookingSource: 'Джерело бронювання',
      sourceCompany: 'Компанія джерела', operatorCompany: 'Компанія оператора', rate: 'Тариф',
      paymentCategory: 'Категорія оплати', guests: 'Гості', primaryGuest: 'Основний гість',
      status: 'Статус', cancellationReason: 'Причина скасування'
      , breakfastServed: 'Подані сніданки', comment: 'Коментар'
    };
    return labels[field] ?? field;
  }

  historyAction(action: string): string {
    const labels: Record<string, string> = {
      CREATED: 'Створив бронювання', UPDATED: 'Змінив бронювання', CANCELLED: 'Скасував бронювання',
      CHECKED_IN: 'Зареєстрував заїзд', CHECKED_OUT: 'Зареєстрував виїзд', NO_SHOW: 'Позначив незаїзд'
      , COMMENT_ADDED: 'Додав коментар', COMMENT_UPDATED: 'Змінив коментар', COMMENT_DELETED: 'Видалив коментар'
    };
    return labels[action] ?? action;
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
