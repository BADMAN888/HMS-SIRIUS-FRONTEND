import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { ReservationService } from '../../../core/services/reservation.service';
import { ProfileService } from '../../../core/services/profile.service';
import { RoomService } from '../../../core/services/room.service';
import { RateService } from '../../../core/services/rate.service';

import { Reservation } from '../../../core/models/reservation/reservation.model';
import { ReservationStatus } from '../../../core/models/enums/reservation-status.enum';

import { ReservationComment } from '../../../core/models/reservation/reservation-comment.model';
import { ReservationCommentResponse } from '../../../core/models/reservation/reservation-comment-response.model';
import {Profile} from '../../../core/models/reservation/profile.model';

@Component({
  selector: 'app-reservation-details',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatAutocompleteModule,
  ],
  templateUrl: './reservation-details.html',
  styleUrl: './reservation-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationDetailsComponent {
  private readonly reservationService = inject(ReservationService);
  private readonly profileService = inject(ProfileService);
  private readonly roomService = inject(RoomService);
  private readonly rateService = inject(RateService);
  private readonly location = inject(Location);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly addingComment = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly reservation = signal<Reservation | null>(null);
  readonly profiles = signal<Profile[]>([]);
  readonly rooms = signal<any[]>([]);
  readonly rates = signal<any[]>([]);

  readonly commentText = signal('');
  readonly selectedGuestId = signal<number | null>(null);
  readonly guestSearch = signal('');

  readonly filteredProfiles = computed(() => {
    const search = this.guestSearch().trim().toLowerCase();

    if (!search) {
      return this.profiles();
    }

    return this.profiles().filter((profile) => {
      const fullName = [
        profile.lastName,
        profile.firstName,
        profile.middleName ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return (
        fullName.includes(search) ||
        profile.phoneNumber.toLowerCase().includes(search) ||
        profile.email.toLowerCase().includes(search)
      );
    });
  });

  readonly statusLabels: Record<ReservationStatus, string> = {
    RESERVED: 'Заброньовано',
    CONFIRMED: 'Підтверджено',
    IN_HOUSE: 'Заселено',
    COMPLETED: 'Завершено',
    CANCELLED: 'Скасовано',
    NO_SHOW: 'Не заїхав',
  };

  readonly statusOptions = Object.entries(this.statusLabels).map(
    ([value, label]) => ({
      value: value as ReservationStatus,
      label,
    }),
  );

  ngOnInit(): void {
    this.loadReservation();
  }

  private loadReservation(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const reservationId = this.getReservationId();

    if (reservationId === null) {
      this.errorMessage.set('Не вдалося визначити номер бронювання.');
      this.loading.set(false);
      return;
    }

    this.reservationService.getById(reservationId).subscribe({
      next: (reservation) => {
        this.reservation.set({
          ...reservation,
          comments: reservation.comments ?? [],
        });

        this.loading.set(false);
        this.loadEditData();
      },
      error: () => {
        this.errorMessage.set('Не вдалося завантажити бронювання.');
        this.loading.set(false);
      },
    });
  }

  private loadEditData(): void {
    forkJoin({
      profiles: this.profileService.getAll(),
      rooms: this.roomService.getAll(),
      rates: this.rateService.getAll(),
    }).subscribe({
      next: ({ profiles, rooms, rates }) => {
        this.profiles.set(
          profiles.map((profile) => ({
            ...profile,
            middleName: profile.middleName ?? null,
          })) as Profile[],
        );

        this.rooms.set(rooms);
        this.rates.set(rates);
      },
      error: () => {
        this.errorMessage.set(
          'Бронювання завантажено, але довідники завантажити не вдалося.',
        );
      },
    });
  }

  private getReservationId(): number | null {
    const segments = this.location.path().split('?')[0].split('/');
    const id = Number(segments.at(-1));

    return Number.isInteger(id) && id > 0 ? id : null;
  }

  getStatusLabel(status: ReservationStatus): string {
    return this.statusLabels[status] ?? status;
  }

  getProfileName(profile: Profile): string {
    return [
      profile.lastName,
      profile.firstName,
      profile.middleName ?? '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  getProfileById(profileId: number): Profile | undefined {
    return this.profiles().find((profile) => profile.id === profileId);
  }

  getRoomLabel(roomId: number): string {
    const room = this.rooms().find((item) => item.id === roomId);

    return room?.roomNumber != null
      ? String(room.roomNumber)
      : String(roomId);
  }

  getRateLabel(rateId: number): string {
    const rate = this.rates().find((item) => item.id === rateId);

    return rate?.name ?? rate?.code ?? String(rateId);
  }

  updateReservation<K extends keyof Reservation>(
    field: K,
    value: Reservation[K],
  ): void {
    this.reservation.update((current) =>
      current ? { ...current, [field]: value } : current,
    );
  }

  onPrimaryGuestChange(profileId: number): void {
    this.updateReservation('primaryGuestId', profileId);

    const current = this.reservation();

    if (!current) {
      return;
    }

    const guestIds = current.guestIds ?? [];

    if (!guestIds.includes(profileId)) {
      this.updateReservation('guestIds', [...guestIds, profileId]);
    }
  }

  addGuest(profileId: number): void {
    const current = this.reservation();

    if (!current) {
      return;
    }

    const guestIds = current.guestIds ?? [];

    if (!guestIds.includes(profileId)) {
      this.updateReservation('guestIds', [...guestIds, profileId]);
    }

    this.selectedGuestId.set(null);
    this.guestSearch.set('');
  }

  removeGuest(profileId: number): void {
    const current = this.reservation();

    if (!current || current.primaryGuestId === profileId) {
      return;
    }

    this.updateReservation(
      'guestIds',
      (current.guestIds ?? []).filter((id) => id !== profileId),
    );
  }

  saveReservation(): void {
    const current = this.reservation();

    if (!current || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const guestIds = [...new Set([
      ...(current.guestIds ?? []),
      current.primaryGuestId,
    ])];

    const updatedReservation = {
      ...current,
      guestIds,
    };

    this.reservationService.update(current.id, updatedReservation).subscribe({
      next: (updated) => {
        this.reservation.set({
          ...updated,
          comments: updated.comments ?? current.comments ?? [],
        });
        this.saving.set(false);
      },
      error: () => {
        this.errorMessage.set('Не вдалося зберегти зміни бронювання.');
        this.saving.set(false);
      },
    });
  }

  addComment(): void {
    const current = this.reservation();
    const text = this.commentText().trim();

    if (!current || !text || this.addingComment()) {
      return;
    }

    const request: ReservationComment = { text };

    this.addingComment.set(true);
    this.errorMessage.set(null);

    this.reservationService.addComment(current.id, request).subscribe({
      next: (comment: ReservationCommentResponse) => {
        this.reservation.update((reservation) =>
          reservation
            ? {
              ...reservation,
              comments: [...(reservation.comments ?? []), comment],
            }
            : reservation,
        );

        this.commentText.set('');
        this.addingComment.set(false);
      },
      error: () => {
        this.errorMessage.set('Не вдалося додати коментар.');
        this.addingComment.set(false);
      },
    });
  }

  removeComment(commentId: number): void {
    const current = this.reservation();

    if (!current) {
      return;
    }

    this.reservationService.deleteComment(current.id, commentId).subscribe({
      next: () => {
        this.reservation.update((reservation) =>
          reservation
            ? {
              ...reservation,
              comments: (reservation.comments ?? []).filter(
                (comment) => comment.id !== commentId,
              ),
            }
            : reservation,
        );
      },
      error: () => {
        this.errorMessage.set('Не вдалося видалити коментар.');
      },
    });
  }

  goBack(): void {
    this.location.back();
  }
}
