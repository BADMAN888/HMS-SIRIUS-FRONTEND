import {DatePipe, DecimalPipe} from '@angular/common';
import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {RouterLink} from '@angular/router';
import {forkJoin, finalize} from 'rxjs';
import {ReservationService} from '../../../core/services/reservation.service';
import {RoomService} from '../../../core/services/room.service';
import {RateService} from '../../../core/services/rate.service';
import {ProfileService} from '../../../core/services/profile.service';
import {Reservation} from '../../../core/models/reservation/reservation.model';
import {Room} from '../../../core/models/hotel/room.model';
import {Rate} from '../../../core/models/billing/rate.model';
import {Profile} from '../../../core/models/reservation/profile.model';
import {ProfileRequest} from '../../../core/models/reservation/profile-request.model';
import {ReservationRequest} from '../../../core/models/reservation/reservation-request.model';
import {RoomStatus} from '../../../core/models/hotel/room-status.enum';

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
  readonly reservations = signal<Reservation[]>([]);
  readonly rooms = signal<Room[]>([]);
  readonly rates = signal<Rate[]>([]);
  readonly profiles = signal<Profile[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly search = signal('');
  readonly statusFilter = signal('ALL');
  readonly showCreate = signal(false);
  readonly showGuestForm = signal(false);
  readonly savingGuest = signal(false);
  readonly guestDraft = {firstName: '', lastName: '', phoneNumber: '', email: ''};
  readonly availableRooms = computed(() => this.rooms().filter(r => r.status === RoomStatus.AVAILABLE));
  readonly availableRates = computed(() => {
    const categoryId = this.rooms().find(r => r.id === Number(this.draft.roomId))?.categoryId;
    return this.rates().filter(r => categoryId === undefined || r.categoryId === categoryId);
  });
  readonly filtered = computed(() => this.reservations().filter(r => {
    const q = this.search().trim().toLowerCase();
    const text = `${r.confirmationNumber} ${r.primaryGuest.firstName} ${r.primaryGuest.lastName} ${r.room.roomNumber}`.toLowerCase();
    return (!q || text.includes(q)) && (this.statusFilter() === 'ALL' || r.status === this.statusFilter());
  }));

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
          this.rates.set(data.rates.filter(r => r.active));
          this.profiles.set(data.profiles);
          this.draft.roomId ||= this.availableRooms()[0]?.id ?? 0;
          this.draft.rateId ||= this.availableRates()[0]?.id ?? 0;
          this.draft.primaryGuestId ||= data.profiles[0]?.id ?? 0;
        }, error: e => this.error.set(e?.error?.message || e?.message || 'Не вдалося завантажити бронювання.')
      });
  }

  create(): void {
    if (!this.draft.roomId || !this.draft.rateId || !this.draft.primaryGuestId || this.draft.checkOut <= this.draft.checkIn) {
      this.error.set('Заповніть гостя, номер, тариф і коректний період проживання.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const request: ReservationRequest = {
      ...this.draft,
      checkIn: this.draft.checkIn,
      checkOut: this.draft.checkOut,
      guestIds: [this.draft.primaryGuestId]
    };
    this.reservationsApi.create(request).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: reservation => {
        this.reservations.update(list => [reservation, ...list]);
        this.showCreate.set(false);
      },
      error: e => this.error.set(e?.error?.message || e?.message || 'Не вдалося створити бронювання.')
    });
  }

  onRoomChange(roomId: number): void {
    this.draft.roomId = Number(roomId);
    if (!this.availableRates().some(rate => rate.id === Number(this.draft.rateId))) this.draft.rateId = this.availableRates()[0]?.id ?? 0;
  }

  createGuest(): void {
    const request: ProfileRequest = {
      firstName: this.guestDraft.firstName.trim(),
      lastName: this.guestDraft.lastName.trim()
    };
    if (this.guestDraft.phoneNumber.trim()) request.phoneNumber = this.guestDraft.phoneNumber.trim();
    if (this.guestDraft.email.trim()) request.email = this.guestDraft.email.trim();
    this.savingGuest.set(true);
    this.error.set('');
    this.profilesApi.create(request).pipe(finalize(() => this.savingGuest.set(false))).subscribe({
      next: profile => {
        this.profiles.update(list => [...list, profile]);
        this.draft.primaryGuestId = profile.id;
        this.showGuestForm.set(false);
        this.guestDraft.firstName = '';
        this.guestDraft.lastName = '';
        this.guestDraft.phoneNumber = '';
        this.guestDraft.email = '';
      },
      error: e => this.error.set(e?.error?.message || e?.message || 'Не вдалося створити профіль гостя.')
    });
  }

  toggleGuestForm(): void {
    this.showGuestForm.update(value => !value);
  }

  guestName(profile: Profile): string {
    return [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  }

  private localDateTime(date: Date): string {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
  }
}
