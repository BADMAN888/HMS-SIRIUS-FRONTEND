
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ReservationService } from '../../../core/services/reservation.service';
import { RoomService } from '../../../core/services/room.service';
import { RateService } from '../../../core/services/rate.service';
import { ProfileService } from '../../../core/services/profile.service';

import { Reservation } from '../../../core/models/reservation/reservation.model';
import { ReservationRequest } from '../../../core/models/reservation/reservation-request.model';
import { ReservationComment } from '../../../core/models/reservation/reservation-comment.model';
import { ReservationCommentResponse } from '../../../core/models/reservation/reservation-comment-response.model';
import { ReservationStatus } from '../../../core/models/enums/reservation-status.enum';
import { RoomResponse } from '../../../core/models/hotel/room-response.model';
import { RateResponse } from '../../../core/models/billing/rate-response.model';
import { ProfileResponse } from '../../../core/models/profile/profile-response.model';

interface ReservationEditForm {
  roomId: number;
  rateId: number;
  primaryGuestId: number;
  guestIds: number[];
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}

type ReservationDetailsData = Omit<Reservation, 'comments'> & {
  comments: ReservationCommentResponse[];
};

@Component({
  selector: 'app-reservation-details',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './reservation-details.html',
  styleUrl: './reservation-details.scss'
})
export class ReservationDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly reservationService = inject(ReservationService);
  private readonly roomService = inject(RoomService);
  private readonly rateService = inject(RateService);
  private readonly profileService = inject(ProfileService);

  readonly reservation = signal<ReservationDetailsData | null>(null);

  readonly rooms = signal<RoomResponse[]>([]);
  readonly rates = signal<RateResponse[]>([]);
  readonly profiles = signal<ProfileResponse[]>([]);

  readonly loading = signal(true);
  readonly loadingReferenceData = signal(true);
  readonly saving = signal(false);
  readonly addingComment = signal(false);
  readonly actionLoading = signal(false);

  readonly error = signal<string | null>(null);
  readonly newComment = signal('');

  readonly editForm = signal<ReservationEditForm>({
    roomId: 0,
    rateId: 0,
    primaryGuestId: 0,
    guestIds: [],
    checkIn: '',
    checkOut: '',
    adults: 1,
    children: 0
  });

  private reservationId: number | null = null;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isInteger(id) || id <= 0) {
      this.error.set('Некоректний ID бронювання.');
      this.loading.set(false);
      this.loadingReferenceData.set(false);
      return;
    }

    this.reservationId = id;

    this.loadReferenceData();
    this.loadReservation(id);
  }

  private loadReferenceData(): void {
    this.loadingReferenceData.set(true);

    forkJoin({
      rooms: this.roomService.getAll(),
      rates: this.rateService.getAll(),
      profiles: this.profileService.getAll()
    })
      .pipe(finalize(() => this.loadingReferenceData.set(false)))
      .subscribe({
        next: result => {
          this.rooms.set(result.rooms);
          this.rates.set(result.rates);
          this.profiles.set(result.profiles);
        },
        error: () => {
          this.error.set(
            'Не вдалося завантажити кімнати, тарифи або профілі гостей.'
          );
        }
      });
  }

  private loadReservation(id: number): void {
    this.loading.set(true);

    this.reservationService.getById(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: reservation => {
          const details: ReservationDetailsData = {
            ...reservation,
            comments: []
          };

          this.reservation.set(details);
          this.initializeEditForm(details);

          this.reservationService.getComments(id).subscribe({
            next: comments => {
              this.reservation.update(current =>
                current
                  ? { ...current, comments }
                  : current
              );
            },
            error: () => {
              this.reservation.update(current =>
                current
                  ? { ...current, comments: [] }
                  : current
              );
            }
          });
        },
        error: () => {
          this.error.set('Не вдалося завантажити бронювання.');
        }
      });
  }

  private initializeEditForm(
    reservation: ReservationDetailsData
  ): void {
    this.editForm.set({
      roomId: reservation.room.id,
      rateId: reservation.rate.id,
      primaryGuestId: reservation.primaryGuest.id,
      guestIds: [...(reservation.guestIds ?? [])],
      checkIn: reservation.checkIn.substring(0, 10),
      checkOut: reservation.checkOut.substring(0, 10),
      adults: reservation.adults,
      children: reservation.children
    });
  }

  updateEditField(
    field: keyof ReservationEditForm,
    value: string | number
  ): void {
    this.editForm.update(form => ({
      ...form,
      [field]: value
    }));
  }

  onGuestIdsChange(value: string): void {
    const guestIds = [
      ...new Set(
        value
          .split(',')
          .map(id => Number(id.trim()))
          .filter(id => Number.isInteger(id) && id > 0)
      )
    ];

    this.editForm.update(form => ({
      ...form,
      guestIds: guestIds.filter(id => id !== form.primaryGuestId)
    }));
  }

  save(): void {
    const reservation = this.reservation();
    const form = this.editForm();

    if (!reservation || this.saving() || this.loadingReferenceData()) {
      return;
    }

    if (
      !form.roomId ||
      !form.rateId ||
      !form.primaryGuestId ||
      !form.checkIn ||
      !form.checkOut ||
      form.checkIn >= form.checkOut ||
      !Number.isInteger(form.adults) ||
      form.adults < 1 ||
      !Number.isInteger(form.children) ||
      form.children < 0
    ) {
      this.error.set(
        'Перевірте поля: кімнату, тариф, гостя, дати та кількість гостей.'
      );
      return;
    }

    const request: ReservationRequest = {
      roomId: form.roomId,
      rateId: form.rateId,
      primaryGuestId: form.primaryGuestId,
      guestIds: form.guestIds,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      adults: form.adults,
      children: form.children
    };

    this.saving.set(true);
    this.error.set(null);

    this.reservationService.update(reservation.id, request)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: updatedReservation => {
          this.reservation.set({
            ...updatedReservation,
            comments: this.reservation()?.comments ?? []
          });

          this.initializeEditForm({
            ...updatedReservation,
            comments: this.reservation()?.comments ?? []
          });

          this.error.set(null);
        },
        error: () => {
          this.error.set(
            'Не вдалося зберегти зміни. Перевірте дані та спробуйте ще раз.'
          );
        }
      });
  }

  addComment(): void {
    const reservation = this.reservation();
    const text = this.newComment().trim();

    if (!reservation || !text || this.addingComment()) {
      return;
    }

    const request: ReservationComment = { text };

    this.addingComment.set(true);

    this.reservationService.createComment(reservation.id, request)
      .pipe(finalize(() => this.addingComment.set(false)))
      .subscribe({
        next: comment => {
          this.reservation.update(current =>
            current
              ? {
                ...current,
                comments: [...current.comments, comment]
              }
              : current
          );

          this.newComment.set('');
          this.error.set(null);
        },
        error: () => {
          this.error.set('Не вдалося додати коментар.');
        }
      });
  }

  cancelReservation(): void {
    const reservation = this.reservation();

    if (
      !reservation ||
      this.actionLoading() ||
      this.saving() ||
      !confirm('Ви впевнені, що хочете скасувати це бронювання?')
    ) {
      return;
    }

    this.actionLoading.set(true);
    this.error.set(null);

    this.reservationService.cancel(reservation.id)
      .pipe(finalize(() => this.actionLoading.set(false)))
      .subscribe({
        next: () => this.loadReservation(reservation.id),
        error: () => {
          this.error.set('Не вдалося скасувати бронювання.');
        }
      });
  }

  markNoShow(): void {
    const reservation = this.reservation();

    if (
      !reservation ||
      this.actionLoading() ||
      this.saving() ||
      !confirm('Позначити бронювання як «Не заїхав»?')
    ) {
      return;
    }

    this.actionLoading.set(true);
    this.error.set(null);

    this.reservationService.noShow(reservation.id)
      .pipe(finalize(() => this.actionLoading.set(false)))
      .subscribe({
        next: () => this.loadReservation(reservation.id),
        error: () => {
          this.error.set('Не вдалося змінити статус бронювання.');
        }
      });
  }

  goBack(): void {
    this.router.navigate(['/hotel-grid']);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      RESERVED: 'Зарезервовано',
      CONFIRMED: 'Підтверджено',
      IN_HOUSE: 'Проживає',
      COMPLETED: 'Завершено',
      CANCELLED: 'Скасовано',
      NO_SHOW: 'Не заїхав'
    };

    return labels[status] ?? status;
  }

  getGenderLabel(gender: string | null | undefined): string {
    if (!gender) {
      return 'Не вказано';
    }

    const labels: Record<string, string> = {
      MALE: 'Чоловіча',
      FEMALE: 'Жіноча',
      OTHER: 'Інша'
    };

    return labels[gender] ?? gender;
  }
}
