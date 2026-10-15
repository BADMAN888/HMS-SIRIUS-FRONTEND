import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { ReservationService } from '../../../core/services/reservation.service';
import { RoomService } from '../../../core/services/room.service';
import { RoomResponse } from '../../../core/models/hotel/room-response.model';
import { ReservationCheckOutResponse } from '../../../core/models/reservation/reservation-check-out-response.model';
import { ReservationStatus } from '../../../core/models/enums/reservation-status.enum';

@Component({
  selector: 'app-check-out',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './check-out.html',
  styleUrl: './check-out.scss'
})
export class CheckOut implements OnInit {
  private readonly reservationService = inject(ReservationService);
  private readonly router = inject(Router);
  private readonly roomService = inject(RoomService);

  readonly reservations = signal<ReservationCheckOutResponse[]>([]);
  readonly selectedDate = signal(this.formatDate(new Date()));
  readonly loading = signal(false);
  readonly error = signal('');
  readonly rooms = signal<RoomResponse[]>([]);
  readonly checkingOutId = signal<number | null>(null);

  readonly pendingCheckOuts = computed(() =>
    this.reservations().filter(
      reservation => reservation.status === ReservationStatus.IN_HOUSE
    ).length
  );

  ngOnInit(): void {
    this.loadCheckOuts();
  }

  onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.value) {
      return;
    }

    this.selectedDate.set(input.value);
    this.loadCheckOuts();
  }

  openReservation(id: number): void {
    this.router.navigate(['/reservations', id]);
  }

  private loadCheckOuts(): void {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      reservations: this.reservationService.getByCheckOutDate(
        this.selectedDate()
      ),
      rooms: this.roomService.getAll().pipe(
        catchError(() => of([] as RoomResponse[]))
      )
    })
      .pipe(
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: data => {
          this.reservations.set(data.reservations);
          this.rooms.set(data.rooms);
        },
        error: error => {
          this.reservations.set([]);

          this.error.set(
            error?.error?.message ||
            error?.message ||
            `Не вдалося завантажити список виїздів. Код відповіді: ${error?.status || 'невідомий'}`
          );
        }
      });
  }

  checkOut(reservation: ReservationCheckOutResponse): void {
    if (
      this.checkingOutId() !== null ||
      reservation.status !== ReservationStatus.IN_HOUSE
    ) {
      return;
    }

    this.checkingOutId.set(reservation.id);
    this.error.set('');

    this.reservationService
      .checkOut(reservation.id)
      .pipe(
        finalize(() => this.checkingOutId.set(null))
      )
      .subscribe({
        next: () => this.loadCheckOuts(),
        error: error => {
          this.error.set(
            error?.error?.message ||
            error?.message ||
            `Не вдалося зареєструвати виїзд. Код відповіді: ${error?.status || 'невідомий'}`
          );
        }
      });
  }

  formatTime(value: string): string {
    return new Date(value).toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getCommentText(reservation: ReservationCheckOutResponse): string {
    return reservation.comments?.map(comment => comment.text).join(', ') || '—';
  }

  getRoomNumber(roomId: number): string {
    return this.rooms().find(room => room.id === roomId)?.roomNumber ?? `#${roomId}`;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
