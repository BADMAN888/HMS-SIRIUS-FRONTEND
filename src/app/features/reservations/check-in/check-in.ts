 import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { ReservationService } from '../../../core/services/reservation.service';

import { RoomService } from '../../../core/services/room.service';
import { RoomResponse } from '../../../core/models/hotel/room-response.model';
 import {ReservationCheckInResponse} from '../../../core/models/reservation/reservation-check-in-response.model';

@Component({
  selector: 'app-check-in',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './check-in.html',
  styleUrl: './check-in.scss'
})
export class CheckIn implements OnInit {
  private readonly reservationService = inject(ReservationService);
  private readonly router = inject(Router);
  private readonly roomService = inject(RoomService);

  readonly reservations = signal<ReservationCheckInResponse[]>([]);
  readonly selectedDate = signal(this.formatDate(new Date()));
  readonly loading = signal(false);
  readonly error = signal('');
  readonly rooms = signal<RoomResponse[]>([]);

  checkingInId = signal<number | null>(null);

  ngOnInit(): void {
    this.loadCheckIns();
  }

  onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;

    this.selectedDate.set(input.value);

    this.loadCheckIns();
  }

  openReservation(id: number): void {
    this.router.navigate(['/reservations', id]);
  }

  private loadCheckIns(): void {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      reservations: this.reservationService.getCheckIns(this.selectedDate()),
      rooms: this.roomService.getAll().pipe(catchError(() => of([] as RoomResponse[])))
    })
      .pipe(
        finalize(() => {
          this.loading.set(false);
        })
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
            `Не вдалося завантажити список заїздів. Код відповіді: ${error?.status || 'невідомий'}`
          );
        }
      });
  }

  checkIn(reservation: ReservationCheckInResponse): void {
    if (this.checkingInId() !== null) {
      return;
    }

    this.checkingInId.set(reservation.id);
    this.error.set('');

    this.reservationService
      .checkIn(reservation.id)
      .pipe(
        finalize(() => {
          this.checkingInId.set(null);
        })
      )
      .subscribe({
        next: () => {
          this.loadCheckIns();
        },
        error: error => {
          this.error.set(
            error?.error?.message ||
            error?.message ||
            `Не вдалося зареєструвати заїзд. Код відповіді: ${error?.status || 'невідомий'}`
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

  getCommentText(reservation: ReservationCheckInResponse): string {
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
