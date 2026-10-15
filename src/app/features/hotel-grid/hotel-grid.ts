import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { HotelGridService } from '../../core/services/hotel-grid.service';
import { HotelGridRoom } from '../../core/models/hotel-grid-room.model';
import { HotelGridReservationResponse } from '../../core/models/hotel-grid/hotel-grid-reservation-response.model';

@Component({
  selector: 'app-hotel-grid',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './hotel-grid.html',
  styleUrl: './hotel-grid.scss'
})
export class HotelGrid implements OnInit {
  private readonly hotelGridService = inject(HotelGridService);

  readonly dayWidth = 92;
  readonly roomColumnWidth = 150;
  readonly numberOfDays = 31;

  days: Date[] = [];
  rooms: HotelGridRoom[] = [];
  periodMonth = '';

  loading = false;
  error = '';

  private gridStart!: Date;
  private gridEnd!: Date;

  ngOnInit(): void {
    this.initializeDays();
    this.loadGrid();
  }

  private initializeDays(): void {
    const today = new Date();

    this.gridStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    this.periodMonth = `${today.getFullYear()}-${String(
  today.getMonth() + 1
).padStart(2, '0')}`;

    this.updateDays();
  }

  changeMonth(offset: number): void {
    const [year, month] = this.periodMonth.split('-').map(Number);
    const next = new Date(year, month - 1 + offset, 1);

    this.setMonth(next.getFullYear(), next.getMonth());
  }

  setSelectedMonth(value: string): void {
    if (!value) {
      return;
    }

    const [year, month] = value.split('-').map(Number);

    if (!year || !month || month < 1 || month > 12) {
      return;
    }

    this.setMonth(year, month - 1);
  }

  goToCurrentMonth(): void {
    const today = new Date();

    this.setMonth(today.getFullYear(), today.getMonth());
  }

  private setMonth(year: number, month: number): void {
    this.gridStart = new Date(year, month, 1);

    this.periodMonth = `${this.gridStart.getFullYear()}-${String(
  this.gridStart.getMonth() + 1
).padStart(2, '0')}`;

    this.updateDays();
    this.loadGrid();
  }

  private updateDays(): void {
    this.gridEnd = this.addDays(
      this.gridStart,
      this.numberOfDays
    );

    this.days = Array.from(
      { length: this.numberOfDays },
      (_, index) => this.addDays(this.gridStart, index)
    );
  }

  private loadGrid(): void {
    this.loading = true;
    this.error = '';

    const startDate = this.formatDate(this.gridStart);
    const endDate = this.formatDate(this.gridEnd);

    this.hotelGridService
      .getGrid(startDate, endDate)
      .pipe(
        catchError(error => {
          this.rooms = [];

          this.error =
            error?.error?.message ||
            error?.message ||
            `Не вдалося завантажити шахматку. HTTP ${error?.status || ''}`;

          return of(null);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe(response => {
        if (response) {
          this.rooms = response.rooms ?? [];
        }
      });
  }

  getReservationsForRoom(
    room: HotelGridRoom
  ): HotelGridReservationResponse[] {
    return room.reservations ?? [];
  }

  getReservationLeft(
    reservation: HotelGridReservationResponse
  ): number {
    const checkIn = this.parseDateTime(reservation.checkIn);

    const visibleStart =
      checkIn < this.gridStart
        ? this.gridStart
        : checkIn;

    const offset = this.getDaysBetween(
      this.gridStart,
      visibleStart
    );

    return this.roomColumnWidth + offset * this.dayWidth;
  }

  getReservationWidth(
    reservation: HotelGridReservationResponse
  ): number {
    const checkIn = this.parseDateTime(reservation.checkIn);
    const checkOut = this.parseDateTime(reservation.checkOut);

    const visibleStart =
      checkIn < this.gridStart
        ? this.gridStart
        : checkIn;

    const visibleEnd =
      checkOut > this.gridEnd
        ? this.gridEnd
        : checkOut;

    const visibleNights = this.getDaysBetween(
      visibleStart,
      visibleEnd
    );

    return Math.max(
      this.dayWidth - 6,
      visibleNights * this.dayWidth - 6
    );
  }

  getReservationLabel(
    reservation: HotelGridReservationResponse
  ): string {
    return `${reservation.confirmationNumber} · ${reservation.status}`;
  }

  formatReservationDate(value: string): string {
    const date = this.parseDateTime(value);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}.${month} ${hours}:${minutes}`;
  }

  isToday(day: Date): boolean {
    return this.formatDate(day) === this.formatDate(new Date());
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);

    result.setDate(result.getDate() + days);

    return result;
  }

  private getDaysBetween(start: Date, end: Date): number {
    const startUtc = Date.UTC(
      start.getFullYear(),
      start.getMonth(),
      start.getDate()
    );

    const endUtc = Date.UTC(
      end.getFullYear(),
      end.getMonth(),
      end.getDate()
    );

    return Math.round(
      (endUtc - startUtc) / (1000 * 60 * 60 * 24)
    );
  }

  private parseDateTime(value: string): Date {
    const [datePart, timePart = '00:00:00'] = value.split('T');

    const [year, month, day] = datePart.split('-').map(Number);
    const [hours = 0, minutes = 0, seconds = 0] = timePart
      .split(':')
      .map(Number);

    return new Date(
      year,
      month - 1,
      day,
      hours,
      minutes,
      seconds || 0
    );
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}

