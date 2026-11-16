import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { HotelGridService } from '../../core/services/hotel-grid.service';
import { HotelGridReservationResponse } from '../../core/models/hotel-grid/hotel-grid-reservation-response.model';
import {HotelGridRoomResponse} from '../../core/models/hotel-grid/hotel-grid-room-response.model';
import { ReservationService } from '../../core/services/reservation.service';
import { ReservationRequest } from '../../core/models/reservation/reservation-request.model';
import { ReservationResponse } from '../../core/models/reservation/reservation-response.model';


@Component({
  selector: 'app-hotel-grid',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './hotel-grid.html',
  styleUrl: './hotel-grid.scss'
})
export class HotelGrid implements OnInit {
  private readonly hotelGridService = inject(HotelGridService);
  private readonly reservationService = inject(ReservationService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly dayWidth = 92;
  readonly roomColumnWidth = 150;
  readonly shiftDays = 10;

  days: Date[] = [];
  rooms: HotelGridRoomResponse[] = [];

  startDateValue = '';
  endDateValue = '';

  loading = false;
  error = '';

  private gridStart!: Date;
  private gridEnd!: Date;
  private cellSelection: { roomId: number; startIndex: number; endIndex: number } | null = null;
  private reservationMove: { reservation: HotelGridReservationResponse; fromRoomId: number; startX: number; startY: number; moved: boolean } | null = null;
  private suppressReservationClick = false;

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
    room: HotelGridRoomResponse
  ): HotelGridReservationResponse[] {
    return (room.reservations ?? []).filter(reservation =>
      reservation.status !== 'CANCELLED' && reservation.status !== 'NO_SHOW'
    );
  }

  startCellSelection(event: PointerEvent, room: HotelGridRoomResponse, dayIndex: number): void {
    if (event.button !== 0) return;
    this.cellSelection = { roomId: room.id, startIndex: dayIndex, endIndex: dayIndex };
  }

  isCellSelected(roomId: number, dayIndex: number): boolean {
    const selection = this.cellSelection;
    if (!selection || selection.roomId !== roomId) return false;
    const low = Math.min(selection.startIndex, selection.endIndex);
    const high = Math.max(selection.startIndex, selection.endIndex);
    return dayIndex >= low && dayIndex <= high;
  }

  startReservationMove(event: PointerEvent, reservation: HotelGridReservationResponse, room: HotelGridRoomResponse): void {
    if (reservation.roomLocked) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.reservationMove = {
      reservation,
      fromRoomId: room.id,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
  }

  openReservation(reservation: HotelGridReservationResponse): void {
    if (this.suppressReservationClick) {
      this.suppressReservationClick = false;
      return;
    }
    void this.router.navigate(['/reservations', reservation.id]);
  }

  @HostListener('document:pointermove', ['$event'])
  onDocumentPointerMove(event: PointerEvent): void {
    if (this.cellSelection) {
      const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      const row = target?.closest<HTMLElement>('.room-row');
      const cell = target?.closest<HTMLElement>('.room-day');
      const index = Number(cell?.dataset['dayIndex']);
      const roomId = Number(row?.dataset['roomId']);
      if (cell && roomId === this.cellSelection.roomId && Number.isInteger(index)) {
        this.cellSelection.endIndex = index;
        this.cdr.detectChanges();
      }
    }

    if (this.reservationMove) {
      const distance = Math.hypot(event.clientX - this.reservationMove.startX, event.clientY - this.reservationMove.startY);
      if (distance > 6) this.reservationMove.moved = true;
    }
  }

  @HostListener('document:pointerup', ['$event'])
  onDocumentPointerUp(event: PointerEvent): void {
    if (this.cellSelection) {
      const selection = this.cellSelection;
      this.cellSelection = null;
      const first = Math.min(selection.startIndex, selection.endIndex);
      let last = Math.max(selection.startIndex, selection.endIndex);
      if (first === last) last += 1;
      const checkInDate = this.days[first];
      const checkOutDate = this.days[last] ?? (this.days.length ? this.addDays(this.days[this.days.length - 1], 1) : undefined);
      if (checkInDate && checkOutDate) {
        void this.router.navigate(['/reservations/new'], {
          queryParams: {
            roomId: selection.roomId,
            checkIn: `${this.formatDate(checkInDate)}T14:00`,
            checkOut: `${this.formatDate(checkOutDate)}T12:00`
          }
        });
      }
    }

    if (this.reservationMove) {
      const move = this.reservationMove;
      this.reservationMove = null;
      if (move.moved) {
        this.suppressReservationClick = true;
        const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
        const roomId = Number(target?.closest<HTMLElement>('.room-row')?.dataset['roomId']);
        if (roomId && roomId !== move.fromRoomId) this.moveReservation(move.reservation, roomId);
        window.setTimeout(() => this.suppressReservationClick = false, 0);
      }
    }
  }

  private moveReservation(reservation: HotelGridReservationResponse, roomId: number): void {
    this.reservationService.getById(reservation.id).subscribe({
      next: details => {
        const request: ReservationRequest = this.toReservationRequest(details, roomId);
        this.reservationService.update(details.id, request).subscribe({
          next: () => this.loadGrid(),
          error: error => {
            this.error = error?.error?.message || error?.message || 'Не вдалося перемістити бронювання.';
            this.cdr.detectChanges();
          }
        });
      },
      error: error => {
        this.error = error?.error?.message || error?.message || 'Не вдалося завантажити бронювання.';
        this.cdr.detectChanges();
      }
    });
  }

  private toReservationRequest(details: ReservationResponse, roomId: number): ReservationRequest {
    return {
      roomId,
      rateId: details.rate.id,
      paymentCategoryId: details.paymentCategoryId,
      primaryGuestId: details.primaryGuest?.id ?? null,
      roomLocked: details.roomLocked,
      guestIds: Array.from(new Set([
        ...(details.guestIds ?? []),
        ...(details.primaryGuest ? [details.primaryGuest.id] : [])
      ])),
      checkIn: details.checkIn,
      checkOut: details.checkOut,
      adults: details.adults,
      children: details.children,
      taxStatus: details.taxStatus,
      externalBookingNumber: details.externalBookingNumber,
      bookingSource: details.bookingSource,
      sourceCompanyId: details.sourceCompany?.id ?? null,
      operatorCompanyId: details.operatorCompany?.id ?? null
    };
  }

  getReservationLeft(
    reservation: HotelGridReservationResponse
  ): number {
    const checkIn = this.parseDateTime(reservation.checkIn);
    const visibleStart = checkIn < this.gridStart ? this.gridStart : checkIn;
    return this.roomColumnWidth + this.getTimelineOffset(visibleStart) * this.dayWidth;
  }

  getReservationWidth(
    reservation: HotelGridReservationResponse
  ): number {
    const checkIn = this.parseDateTime(reservation.checkIn);
    const checkOut = this.parseDateTime(reservation.checkOut);

    const visibleStart = checkIn < this.gridStart ? this.gridStart : checkIn;
    const visibleEnd = checkOut > this.gridEnd ? this.gridEnd : checkOut;

    const visibleDuration = this.getTimelineOffset(visibleEnd) - this.getTimelineOffset(visibleStart);

    return Math.max(14, visibleDuration * this.dayWidth - 6);
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

  private getTimelineOffset(date: Date): number {
    const dayStart = this.startOfDay(date);
    const dayOffset = this.getDaysBetween(this.gridStart, dayStart);
    const minutes = date.getHours() * 60 + date.getMinutes();
    return dayOffset + minutes / 1440;
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
