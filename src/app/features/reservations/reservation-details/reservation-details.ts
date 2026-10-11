import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { RateResponse } from '../../../core/models/billing/rate-response.model';
import { RoomResponse } from '../../../core/models/hotel/room-response.model';
import { ProfileResponse } from '../../../core/models/profile/profile-response.model';
import { ReservationRequest } from '../../../core/models/reservation/reservation-request.model';
import { ReservationResponse } from '../../../core/models/reservation/reservation-response.model';

import { ProfileService } from '../../../core/services/profile.service';
import { RateService } from '../../../core/services/rate.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { RoomService } from '../../../core/services/room.service';

@Component({
  selector: 'app-reservation-details',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './reservation-details.html',
  styleUrl: './reservation-details.scss'
})
export class ReservationDetails implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reservationService = inject(ReservationService);
  private readonly profileService = inject(ProfileService);
  private readonly roomService = inject(RoomService);
  private readonly rateService = inject(RateService);

  readonly reservation = signal<ReservationResponse | null>(null);

  readonly profiles = signal<ProfileResponse[]>([]);
  readonly rooms = signal<RoomResponse[]>([]);
  readonly rates = signal<RateResponse[]>([]);

  readonly editRoomId = signal(0);
  readonly editRateId = signal(0);
  readonly editPrimaryGuestId = signal(0);
  readonly editGuestIds = signal<number[]>([]);
  readonly editCheckIn = signal('');
  readonly editCheckOut = signal('');
  readonly editAdults = signal(1);
  readonly editChildren = signal(0);

  readonly loading = signal(true);
  readonly loadingEditData = signal(true);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly actionBusy = signal(false);

  readonly error = signal('');
  readonly saveError = signal('');

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!id || !Number.isInteger(id) || id < 1) {
      this.error.set('Некоректний ID бронювання.');
      this.loading.set(false);
      this.loadingEditData.set(false);
      return;
    }

    this.loadReservation(id);
    this.loadEditData();
  }

  private loadReservation(id: number): void {
    this.loading.set(true);
    this.error.set('');
    this.saveError.set('');
    this.saved.set(false);

    this.reservationService
      .getById(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: reservation => {
          this.reservation.set(reservation);
          this.initializeForm(reservation);
        },
        error: error => {
          this.error.set(
            error?.error?.message ||
            error?.message ||
            `Не вдалося завантажити бронювання. HTTP ${error?.status || ''}`
          );
        }
      });
  }

  private loadEditData(): void {
    this.loadingEditData.set(true);

    forkJoin({
      profiles: this.profileService.getAll(),
      rooms: this.roomService.getAll(),
      rates: this.rateService.getAll()
    })
      .pipe(finalize(() => this.loadingEditData.set(false)))
      .subscribe({
        next: data => {
          this.profiles.set(data.profiles);
          this.rooms.set(data.rooms);
          this.rates.set(data.rates);
        },
        error: error => {
          this.saveError.set(
            error?.error?.message ||
            error?.message ||
            `Не вдалося завантажити дані для редагування. HTTP ${error?.status || ''}`
          );
        }
      });
  }

  save(): void {
    const reservation = this.reservation();

    if (
      !reservation ||
      !this.canEdit() ||
      this.saving() ||
      this.loadingEditData()
    ) {
      return;
    }

    const checkIn = this.editCheckIn();
    const checkOut = this.editCheckOut();

    if (
      !this.editRoomId() ||
      !this.editRateId() ||
      !this.editPrimaryGuestId() ||
      !checkIn ||
      !checkOut ||
      checkOut <= checkIn ||
      this.editAdults() < 1 ||
      this.editChildren() < 0
    ) {
      this.saveError.set('Перевірте правильність заповнення полів.');
      return;
    }

    this.saving.set(true);
    this.saved.set(false);
    this.saveError.set('');

    const guestIds = Array.from(
      new Set([
        ...this.editGuestIds(),
        this.editPrimaryGuestId()
      ])
    );

    const request: ReservationRequest = {
      roomId: this.editRoomId(),
      rateId: this.editRateId(),
      primaryGuestId: this.editPrimaryGuestId(),
      guestIds,
      checkIn: this.toLocalDateTime(checkIn),
      checkOut: this.toLocalDateTime(checkOut),
      adults: this.editAdults(),
      children: this.editChildren()
    };

    this.reservationService
      .update(reservation.id, request)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: updatedReservation => {
          this.reservation.set(updatedReservation);
          this.initializeForm(updatedReservation);
          this.saved.set(true);
        },
        error: error => {
          this.saveError.set(
            error?.error?.message ||
            error?.message ||
            `Не вдалося зберегти бронювання. HTTP ${error?.status || ''}`
          );
        }
      });
  }

  cancelReservation(): void {
    this.runLifecycleAction('cancel');
  }

  markNoShow(): void {
    this.runLifecycleAction('no-show');
  }

  private runLifecycleAction(action: 'cancel' | 'no-show'): void {
    const reservation = this.reservation();

    if (!reservation || this.actionBusy()) {
      return;
    }

    const message =
      action === 'cancel'
        ? 'Скасувати це бронювання?'
        : 'Позначити гостя як такого, що не заїхав?';

    if (!window.confirm(message)) {
      return;
    }

    this.actionBusy.set(true);
    this.saveError.set('');
    this.saved.set(false);

    const request =
      action === 'cancel'
        ? this.reservationService.cancel(reservation.id)
        : this.reservationService.noShow(reservation.id);

    request
      .pipe(finalize(() => this.actionBusy.set(false)))
      .subscribe({
        next: () => this.loadReservation(reservation.id),
        error: error => {
          this.saveError.set(
            error?.error?.message ||
            error?.message ||
            'Не вдалося оновити статус бронювання.'
          );
        }
      });
  }

  onGuestIdsChange(event: Event): void {
    const select = event.target as HTMLSelectElement;

    this.editGuestIds.set(
      Array.from(select.selectedOptions).map(option => Number(option.value))
    );
  }

  private initializeForm(reservation: ReservationResponse): void {
    this.editRoomId.set(reservation.room.id);
    this.editRateId.set(reservation.rate.id);
    this.editPrimaryGuestId.set(reservation.primaryGuest.id);
    this.editGuestIds.set([...reservation.guestIds]);
    this.editCheckIn.set(this.toDateTimeLocal(reservation.checkIn));
    this.editCheckOut.set(this.toDateTimeLocal(reservation.checkOut));
    this.editAdults.set(reservation.adults);
    this.editChildren.set(reservation.children);
  }

  canEdit(): boolean {
    const status = this.reservation()?.status;

    return status === 'RESERVED' || status === 'CONFIRMED';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      RESERVED: 'Зарезервовано',
      CONFIRMED: 'Підтверджено',
      IN_HOUSE: 'Проживає',
      CHECKED_IN: 'Проживає',
      COMPLETED: 'Завершено',
      CANCELLED: 'Скасовано',
      NO_SHOW: 'Не заїхав'
    };

    return labels[status] ?? status;
  }

  genderLabel(gender: string | null | undefined): string {
    const labels: Record<string, string> = {
      MALE: 'Чоловіча',
      FEMALE: 'Жіноча',
      HELICOPTER: 'Не вказано'
    };

    return labels[gender ?? ''] ?? '—';
  }

  goBack(): void {
    this.router.navigate(['/reservations']);
  }

  getProfileName(profile: ProfileResponse): string {
    return [
      profile.lastName,
      profile.firstName,
      profile.middleName
    ]
      .filter(Boolean)
      .join(' ');
  }

  getGuestDocument(): string {
    const document = this.reservation()?.primaryGuest?.guestDocument;

    if (!document) {
      return '—';
    }

    return Object.values(document)
      .filter(
        value =>
          value !== null &&
          value !== undefined &&
          value !== ''
      )
      .join(' ');
  }

  private toDateTimeLocal(value: string): string {
    return value ? value.slice(0, 16) : '';
  }

  private toLocalDateTime(value: string): string {
    return value.length === 16 ? `${value}:00` : value;
  }
}
