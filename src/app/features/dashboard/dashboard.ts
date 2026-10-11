import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { forkJoin } from 'rxjs';
import { ReservationService } from '../../core/services/reservation.service';
import { RoomService } from '../../core/services/room.service';
import { Reservation } from '../../core/models/reservation/reservation.model';
import { Room } from '../../core/models/hotel/room.model';
import { RoomStatus } from '../../core/models/hotel/room-status.enum';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, MatCardModule, MatIconModule, MatChipsModule, MatDividerModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {
  private readonly reservationsApi = inject(ReservationService);
  private readonly roomsApi = inject(RoomService);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly reservations = signal<Reservation[]>([]);
  readonly rooms = signal<Room[]>([]);
  readonly todayLabel = new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  readonly today = this.localDate(new Date());

  ngOnInit(): void {
    forkJoin({
      reservations: this.reservationsApi.getAll(),
      rooms: this.roomsApi.getAll()
    }).subscribe({
      next: data => { this.reservations.set(data.reservations); this.rooms.set(data.rooms); this.loading.set(false); },
      error: e => { this.error.set(e?.error?.message || 'Не вдалося завантажити дані готелю. Перевірте з’єднання з сервером.'); this.loading.set(false); }
    });
  }

  arrivals(): Reservation[] { return this.reservations().filter(r => r.checkIn.slice(0, 10) === this.today); }
  departures(): Reservation[] { return this.reservations().filter(r => r.checkOut.slice(0, 10) === this.today); }
  availableRooms(): number { return this.rooms().filter(r => r.status === RoomStatus.AVAILABLE).length; }
  occupancy(): number { return this.rooms().length ? Math.round((this.rooms().length - this.availableRooms()) / this.rooms().length * 100) : 0; }
  recentReservations(): Reservation[] { return [...this.reservations()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5); }
  guestName(reservation: Reservation): string { return `${reservation.primaryGuest.firstName} ${reservation.primaryGuest.lastName}`; }
  private localDate(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
}
