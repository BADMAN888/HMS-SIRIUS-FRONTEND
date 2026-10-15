import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { ReservationService } from '../../../core/services/reservation.service';
import { Reservation } from '../../../core/models/reservation/reservation.model';
import { ReservationStatus } from '../../../core/models/enums/reservation-status.enum';

@Component({
  selector: 'app-in-house',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule
  ],
  templateUrl: './in-house.html',
  styleUrl: './in-house.scss'
})
export class InHouseComponent implements OnInit {
  private readonly reservationService = inject(ReservationService);
  private readonly router = inject(Router);

  readonly guests = signal<Reservation[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly displayedColumns = [
    'guest',
    'roomNumber',
    'confirmationNumber',
    'checkIn',
    'checkOut',
    'status'
  ];

  ngOnInit(): void {
    this.loadGuests();
  }

  loadGuests(): void {
    this.loading.set(true);
    this.error.set(null);

    this.reservationService
      .getByStatus(ReservationStatus.IN_HOUSE)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: reservations => this.guests.set(reservations),
        error: error => {
          this.guests.set([]);
          this.error.set(
            error?.error?.message ||
            'Не вдалося завантажити список гостей.'
          );
        }
      });
  }

  getGuestName(reservation: Reservation): string {
    const guest = reservation.primaryGuest;

    return [
      guest?.lastName,
      guest?.firstName,
      guest?.middleName
    ]
      .filter(Boolean)
      .join(' ');
  }

  openReservation(id: number): void {
    this.router.navigate(['/reservations', id]);
  }
}
