import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import {ReservationService} from '../../../core/services/reservation.service';
import {InHouse} from '../../../core/models/reservation/reservation-in-house.model';


@Component({
  selector: 'app-in-house',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
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

  readonly guests = signal<InHouse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly displayedColumns = [
    'guest',
    'roomNumber',
    'checkIn',
    'checkOut',
    'totalAmount'
  ];

  ngOnInit(): void {
    this.loadGuests();
  }

  loadGuests(): void {
    this.loading.set(true);
    this.error.set(null);

    this.reservationService.getInHouse().subscribe({
      next: guests => {
        this.guests.set(guests);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Не вдалося завантажити список гостей.');
        this.loading.set(false);
      }
    });
  }

  getGuestName(guest: InHouse): string {
    return [
      guest.guestLastName,
      guest.guestFirstName,
      guest.guestMiddleName
    ]
      .filter(Boolean)
      .join(' ');
  }
}
