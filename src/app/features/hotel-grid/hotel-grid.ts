import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { HotelGridService } from '../../core/services/hotel-grid.service';
import { HotelGridRoom } from '../../core/models/reservation/hotel-grid-room.model';
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
  private readonly cdr = inject(ChangeDetectorRef);

  readonly dayWidth = 92;
  readonly roomColumnWidth = 150;
  readonly shiftDays = 10;

  days: Date[] = [];
  rooms: HotelGridRoom[] = [];

  startDateValue = '';
  endDateValue = '';

  loading = false;
  error = '';

  private gridStart!: Date;
  private gridEnd!: Date;

  get numberOfDays(): number {
    return this.days.length;
  }

  ngOnInit(): void {
    const today = this.startOfDay(new Date());

    this.gridStart = today;
    this.gridEnd = this.addDays(today, 31);

    this.syncDateInputs();
    this.updateDays();
    this.loadGrid();
  }

  movePeriod(offset: number): void {
    this.gridStart = this.addDays(this.gridStart, offset);
    this.gridEnd = this.addDays(this.gridEnd, offset);

    this.syncDateInputs();
    this.updateDays();
    this.loadGrid();
  }

  goToToday(): void {
    this.gridStart = this.startOfDay(new Date());
    this.gridEnd = this.addDays(this.gridStart, 31);

    this.syncDateInputs();
    this.updateDays();
    this.loadGrid();
  }

  applyDateRange(): void {
    if (!this.startDateValue || !this.endDateValue) {
      this.error = 'Вибери початкову та кінцеву дату.';
      return;
    }

    const start = this.parseInputDate(this.startDateValue);
    const end = this.parseInputDate(this.endDateValue);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      this.error = 'Вкажи коректний діапазон дат.';
      return;
    }

    if (end <= start) {
      this.error = 'Кінцева дата має бути пізніше початкової.';
      return;
    }

    this.gridStart = start;
    this.gridEnd = end;

    this.updateDays();
    this.loadGrid();
  }

  private syncDateInputs(): void {
    this.startDateValue = this.formatDate(this.gridStart);
    this.endDateValue = this.formatDate(this.gridEnd);
  }

  private updateDays(): void {
    const count = this.getDaysBetween(this.gridStart, this.gridEnd);

    this.days = Array.from(
      { length: count },
      (_, index) => this.addDays(this.gridStart, index)
    );
  }

  private loadGrid(): void {
    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();

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
          this.cdr.detectChanges();
        })
      )
      .subscribe(response => {
        if (response) {
          this.rooms = response.rooms ?? [];
        }

        this.cdr.detectChanges();
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
    const visibleStart = checkIn < this.gridStart ? this.gridStart : checkIn;

    return this.roomColumnWidth +
      this.getDaysBetween(this.gridStart, visibleStart) * this.dayWidth;
  }

  getReservationWidth(
    reservation: HotelGridReservationResponse
  ): number {
    const checkIn = this.parseDateTime(reservation.checkIn);
    const checkOut = this.parseDateTime(reservation.checkOut);

    const visibleStart = checkIn < this.gridStart ? this.gridStart : checkIn;
    const visibleEnd = checkOut > this.gridEnd ? this.gridEnd : checkOut;

    const visibleNights = this.getDaysBetween(visibleStart, visibleEnd);

    return Math.max(this.dayWidth - 6, visibleNights * this.dayWidth - 6);
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

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

    return Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24));
  }

  private parseInputDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private parseDateTime(value: string): Date {
    const [datePart, timePart = '00:00:00'] = value.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours = 0, minutes = 0, seconds = 0] = timePart
      .split(':')
      .map(Number);

    return new Date(year, month - 1, day, hours, minutes, seconds || 0);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
