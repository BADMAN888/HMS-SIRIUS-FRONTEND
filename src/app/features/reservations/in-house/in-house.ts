import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReservationService } from '../../../core/services/reservation.service';

import { ReservationStatus } from '../../../core/models/enums/reservation-status.enum';
import {ReservationResponse} from '../../../core/models/reservation/reservation-response.model';
import { FolioService } from '../../../core/services/folio.service';
import { AccrualService } from '../../../core/services/accrual.service';
import { FolioResponse } from '../../../core/models/billing/folio-response.model';
import { AccrualResponse } from '../../../core/models/billing/accrual-response.model';
import { FolioStatus } from '../../../core/models/enums/folio-status.enum';

@Component({
  selector: 'app-in-house',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './in-house.html',
  styleUrl: './in-house.scss'
})
export class InHouseComponent implements OnInit {
  private readonly reservationService = inject(ReservationService);
  private readonly folioService = inject(FolioService);
  private readonly accrualService = inject(AccrualService);
  private readonly router = inject(Router);

  readonly guests = signal<ReservationResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly amountError = signal(false);
  readonly totalsByReservationId = signal<Record<number, number>>({});

  ngOnInit(): void {
    this.loadGuests();
  }

  loadGuests(): void {
    this.loading.set(true);
    this.error.set(null);
    this.amountError.set(false);

    forkJoin({
      reservations: this.reservationService.getByStatus(ReservationStatus.IN_HOUSE),
      folios: this.folioService.getAll().pipe(catchError(() => {
        this.amountError.set(true);
        return of([] as FolioResponse[]);
      })),
      accruals: this.accrualService.getAll().pipe(catchError(() => {
        this.amountError.set(true);
        return of([] as AccrualResponse[]);
      }))
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: data => {
          this.guests.set(data.reservations);
          this.totalsByReservationId.set(this.calculateTotals(data.folios, data.accruals));
        },
        error: error => {
          this.guests.set([]);
          this.totalsByReservationId.set({});
          this.error.set(
            error?.error?.message ||
            'Не вдалося завантажити список гостей.'
          );
        }
      });
  }

  getGuestName(reservation: ReservationResponse): string {
    const guest = reservation.primaryGuest;

    return [
      guest?.lastName,
      guest?.firstName,
      guest?.middleName
    ]
      .filter(Boolean)
      .join(' ');
  }

  getCommentText(reservation: ReservationResponse): string {
    return reservation.comments?.map(comment => comment.text).join(', ') || '—';
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

  openReservation(id: number): void {
    this.router.navigate(['/reservations', id]);
  }
}
