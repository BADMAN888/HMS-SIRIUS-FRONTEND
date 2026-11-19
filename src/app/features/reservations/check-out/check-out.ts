import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { ReservationService } from '../../../core/services/reservation.service';
import { RoomService } from '../../../core/services/room.service';
import { RoomResponse } from '../../../core/models/hotel/room-response.model';
import { ReservationCheckOutResponse } from '../../../core/models/reservation/reservation-check-out-response.model';
import { ReservationStatus } from '../../../core/models/enums/reservation-status.enum';
import { FolioService } from '../../../core/services/folio.service';
import { AccrualService } from '../../../core/services/accrual.service';
import { FolioResponse } from '../../../core/models/billing/folio-response.model';
import { AccrualResponse } from '../../../core/models/billing/accrual-response.model';
import { FolioStatus } from '../../../core/models/enums/folio-status.enum';

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
  private readonly folioService = inject(FolioService);
  private readonly accrualService = inject(AccrualService);

  readonly reservations = signal<ReservationCheckOutResponse[]>([]);
  readonly selectedDate = signal(this.formatDate(new Date()));
  readonly loading = signal(false);
  readonly error = signal('');
  readonly rooms = signal<RoomResponse[]>([]);
  readonly checkingOutId = signal<number | null>(null);
  readonly totalsByReservationId = signal<Record<number, number>>({});
  readonly amountError = signal(false);

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
    this.amountError.set(false);

    forkJoin({
      reservations: this.reservationService.getByCheckOutDate(
        this.selectedDate()
      ),
      rooms: this.roomService.getAll().pipe(
        catchError(() => of([] as RoomResponse[]))
      ),
      folios: this.folioService.getAll().pipe(catchError(() => {
        this.amountError.set(true);
        return of([] as FolioResponse[]);
      })),
      accruals: this.accrualService.getAll().pipe(catchError(() => {
        this.amountError.set(true);
        return of([] as AccrualResponse[]);
      }))
    })
      .pipe(
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: data => {
          this.reservations.set(data.reservations);
          this.rooms.set(data.rooms);
          this.totalsByReservationId.set(this.calculateTotals(data.folios, data.accruals));
        },
        error: error => {
          this.reservations.set([]);
          this.totalsByReservationId.set({});

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
      reservation.status !== ReservationStatus.IN_HOUSE ||
      this.amountError() ||
      this.getReservationTotal(reservation.id) !== 0
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

  getReservationTotal(reservationId: number): number {
    return this.totalsByReservationId()[reservationId] ?? 0;
  }

  private calculateTotals(folios: FolioResponse[], accruals: AccrualResponse[]): Record<number, number> {
    const totals: Record<number, number> = {};
    for (const folio of folios) {
      if (folio.status !== FolioStatus.OPEN || folio.reservationId === null) continue;
      totals[folio.reservationId] = Math.round(((totals[folio.reservationId] ?? 0) + Number(folio.balance ?? 0)) * 100) / 100;
    }
    for (const accrual of accruals) {
      if (!accrual.active || accrual.folioId !== null || accrual.reservationId === null) continue;
      totals[accrual.reservationId] = Math.round(((totals[accrual.reservationId] ?? 0) + Number(accrual.amount ?? 0)) * 100) / 100;
    }
    return totals;
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

  getRoomStatusClass(roomId: number): string {
    const room = this.rooms().find(item => item.id === roomId);
    if (!room) return 'occupied';
    if (room.status === 'OCCUPIED') return 'occupied';
    if (room.status === 'CLEANING') return 'cleaning';
    if (room.status === 'DIRTY' || !room.clean) return 'dirty';
    return 'available';
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
