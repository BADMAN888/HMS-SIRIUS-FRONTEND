import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { ReservationService } from '../../../core/services/reservation.service';
import { RoomService } from '../../../core/services/room.service';
import { RateService } from '../../../core/services/rate.service';
import { ProfileService } from '../../../core/services/profile.service';

import { ReservationResponse } from '../../../core/models/reservation/reservation-response.model';
import { ReservationRequest } from '../../../core/models/reservation/reservation-request.model';
import { ProfileResponse } from '../../../core/models/profile/profile-response.model';
import { ProfileRequest } from '../../../core/models/profile/profile-request.model';
import { RoomStatus } from '../../../core/models/hotel/room-status.enum';
import { RoomResponse } from '../../../core/models/hotel/room-response.model';
import { RateResponse } from '../../../core/models/billing/rate-response.model';

@Component({
  selector: 'app-reservation-list',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, MatIconModule, RouterLink],
  templateUrl: './reservation-list.html',
  styleUrl: './reservation-list.scss'
})
export class ReservationList implements OnInit {
  private readonly reservationsApi = inject(ReservationService);
  private readonly roomsApi = inject(RoomService);
  private readonly ratesApi = inject(RateService);
  private readonly profilesApi = inject(ProfileService);

  readonly reservations = signal<ReservationResponse[]>([]);
  readonly rooms = signal<RoomResponse[]>([]);
  readonly rates = signal<RateResponse[]>([]);
  readonly profiles = signal<ProfileResponse[]>([]);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly search = signal('');
  readonly statusFilter = signal('ALL');
  readonly showCreate = signal(false);
  readonly showGuestForm = signal(false);
  readonly savingGuest = signal(false);

  readonly guestDraft = {
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: ''
  };

  readonly availableRooms = computed(() =>
    this.rooms().filter(room => room.status === RoomStatus.AVAILABLE)
  );

  readonly availableRates = computed(() => {
    const categoryId = this.rooms().find(
      room => room.id === Number(this.draft.roomId)
    )?.categoryId;

    return this.rates().filter(
      rate => categoryId === undefined || rate.categoryId === categoryId
    );
  });

  readonly filtered = computed(() =>
    this.reservations().filter(reservation => {
      const query = this.search().trim().toLowerCase();

      const text = [
        reservation.confirmationNumber,
        reservation.primaryGuest.firstName,
        reservation.primaryGuest.lastName,
        reservation.room.roomNumber
      ].join(' ').toLowerCase();

      return (
        (!query || text.includes(query)) &&
        (this.statusFilter() === 'ALL' ||
          reservation.status === this.statusFilter())
      );
    })
  );

  draft = {
    roomId: 0,
    rateId: 0,
    primaryGuestId: 0,
    checkIn: this.localDateTime(new Date()),
    checkOut: this.localDateTime(new Date(Date.now() + 86400000)),
    adults: 1,
    children: 0
  };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      reservations: this.reservationsApi.getAll(),
      rooms: this.roomsApi.getAll(),
      rates: this.ratesApi.getAll(),
      profiles: this.profilesApi.getAll()
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: data => {
          this.reservations.set(data.reservations);
          this.rooms.set(data.rooms);
          this.rates.set(data.rates.filter(rate => rate.active));
          this.profiles.set(data.profiles);

          this.draft.roomId ||= this.availableRooms()[0]?.id ?? 0;
          this.draft.rateId ||= this.availableRates()[0]?.id ?? 0;
          this.draft.primaryGuestId ||= data.profiles[0]?.id ?? 0;
        },
        error: error =>
          this.error.set(
            error?.error?.message ||
            error?.message ||
            'Не вдалося завантажити бронювання.'
          )
      });
  }

  create(): void {
    if (
      !this.draft.roomId ||
      !this.draft.rateId ||
      !this.draft.primaryGuestId ||
      this.draft.checkOut <= this.draft.checkIn
    ) {
      this.error.set(
        'Заповніть гостя, номер, тариф і коректний період проживання.'
      );
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const request: ReservationRequest = {
      roomId: this.draft.roomId,
      rateId: this.draft.rateId,
      primaryGuestId: this.draft.primaryGuestId,
      guestIds: [this.draft.primaryGuestId],
      checkIn: this.draft.checkIn,
      checkOut: this.draft.checkOut,
      adults: this.draft.adults,
      children: this.draft.children
    };

    this.reservationsApi
      .create(request)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: reservation => {
          this.reservations.update(list => [reservation, ...list]);
          this.showCreate.set(false);
        },
        error: error =>
          this.error.set(
            error?.error?.message ||
            error?.message ||
            'Не вдалося створити бронювання.'
          )
      });
  }

  onRoomChange(roomId: number): void {
    this.draft.roomId = Number(roomId);

    if (
      !this.availableRates().some(
        rate => rate.id === Number(this.draft.rateId)
      )
    ) {
      this.draft.rateId = this.availableRates()[0]?.id ?? 0;
    }
  }

  createGuest(): void {
    const firstName = this.guestDraft.firstName.trim();
    const lastName = this.guestDraft.lastName.trim();

    if (!firstName || !lastName) {
      this.error.set('Вкажіть ім’я та прізвище гостя.');
      return;
    }

    const request: ProfileRequest = {
      firstName,
      lastName,
      middleName: null,
      phoneNumber: this.guestDraft.phoneNumber.trim() || null,
      email: this.guestDraft.email.trim() || null,
      gender: null,
      address: null,
      guestDocument: null
    };

    this.savingGuest.set(true);
    this.error.set('');

    this.profilesApi
      .create(request)
      .pipe(finalize(() => this.savingGuest.set(false)))
      .subscribe({
        next: profile => {
          this.profiles.update(list => [...list, profile]);
          this.draft.primaryGuestId = profile.id;
          this.showGuestForm.set(false);

          this.guestDraft.firstName = '';
          this.guestDraft.lastName = '';
          this.guestDraft.phoneNumber = '';
          this.guestDraft.email = '';
        },
        error: error =>
          this.error.set(
            error?.error?.message ||
            error?.message ||
            'Не вдалося створити профіль гостя.'
          )
      });
  }

  toggleGuestForm(): void {
    this.showGuestForm.update(value => !value);
  }

  guestName(profile: ProfileResponse): string {
    return [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  }

  private localDateTime(date: Date): string {
    const offset = date.getTimezoneOffset();

    return new Date(date.getTime() - offset * 60000)
      .toISOString()
      .slice(0, 16);
  }
}
