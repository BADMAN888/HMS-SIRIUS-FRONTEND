import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReservationResponse } from '../../core/models/reservation/reservation-response.model';
import { ProfileResponse } from '../../core/models/profile/profile-response.model';
import { ReservationStatus } from '../../core/models/enums/reservation-status.enum';
import { Nationality } from '../../core/models/enums/nationality.enum';
import { ReservationService } from '../../core/services/reservation.service';
import { ProfileService } from '../../core/services/profile.service';
import { RoomService } from '../../core/services/room.service';
import { RateService } from '../../core/services/rate.service';
import { CompanyService } from '../../core/services/company.service';
import { RoomResponse } from '../../core/models/hotel/room-response.model';
import { RateResponse } from '../../core/models/billing/rate-response.model';
import { CompanyResponse } from '../../core/models/company-response.model';

interface SearchFilters {
  confirmationNumber: string; roomNumber: string; rate: string; checkInFrom: string; checkInTo: string;
  checkOutFrom: string; checkOutTo: string; createdFrom: string; createdTo: string;
  externalBookingNumber: string; bookingSource: string; sourceCompany: string; operatorCompany: string;
  status: string; firstName: string; lastName: string; middleName: string; phoneNumber: string;
  email: string; dateOfBirth: string; nationality: string; vip: string; inBlackList: string;
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [DatePipe, FormsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './search.html',
  styleUrl: './search.scss'
})
export class SearchComponent implements OnInit {
  private readonly reservationService = inject(ReservationService);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly roomService = inject(RoomService);
  private readonly rateService = inject(RateService);
  private readonly companyService = inject(CompanyService);

  readonly reservations = signal<ReservationResponse[]>([]);
  readonly results = signal<ReservationResponse[]>([]);
  readonly profiles = signal<ProfileResponse[]>([]);
  readonly rooms = signal<RoomResponse[]>([]);
  readonly rates = signal<RateResponse[]>([]);
  readonly companies = signal<CompanyResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly statuses = Object.values(ReservationStatus);
  readonly nationalities = Object.values(Nationality);
  readonly calendarOpen = signal<'checkIn' | 'checkOut' | 'created' | null>(null);
  readonly calendarMonth = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly calendarDays = signal<{ date: Date; iso: string; currentMonth: boolean }[]>([]);
  private selectingEnd = false;
  readonly filters: SearchFilters = {
    confirmationNumber: '', roomNumber: '', rate: '', checkInFrom: '', checkInTo: '',
    checkOutFrom: '', checkOutTo: '', createdFrom: '', createdTo: '',
    externalBookingNumber: '', bookingSource: '', sourceCompany: '', operatorCompany: '',
    status: '', firstName: '', lastName: '', middleName: '', phoneNumber: '',
    email: '', dateOfBirth: '', nationality: '', vip: '', inBlackList: ''
  };

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ reservations: this.reservationService.getAll(), profiles: this.profileService.getAll(), rooms: this.roomService.getAll(), rates: this.rateService.getAll(), companies: this.companyService.getAll() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: data => {
          this.reservations.set(data.reservations);
          this.profiles.set(data.profiles);
          this.rooms.set(data.rooms);
          this.rates.set(data.rates);
          this.companies.set(data.companies);
          this.applyFilters();
        },
        error: err => {
          this.reservations.set([]); this.profiles.set([]); this.results.set([]);
          this.error.set(err?.error?.message || 'Не вдалося завантажити дані для пошуку.');
        }
      });
  }

  applyFilters(): void {
    const f = this.filters;
    const profileMap = new Map(this.profiles().map(profile => [profile.id, profile]));
    const contains = (actual: unknown, query: string) => !query || String(actual ?? '').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    const inRange = (value: string | null | undefined, from: string, to: string) => {
      if (!from && !to) return true;
      if (!value) return false;
      const date = value.slice(0, 10);
      return (!from || date >= from) && (!to || date <= to);
    };
    this.results.set(this.reservations().filter(r => {
      const reservationProfiles = [r.primaryGuest, ...r.guestIds.map(id => profileMap.get(id))]
        .filter((p): p is ProfileResponse => !!p);
      const guestMatches = !(['firstName', 'lastName', 'middleName', 'phoneNumber', 'email', 'dateOfBirth', 'nationality', 'vip', 'inBlackList'] as const)
        .some(key => f[key]) || reservationProfiles.some(p =>
          contains(p.firstName, f.firstName) && contains(p.lastName, f.lastName) &&
          contains(p.middleName, f.middleName) && contains(p.phoneNumber, f.phoneNumber) &&
          contains(p.email, f.email) && contains(p.dateOfBirth, f.dateOfBirth) &&
          contains(p.nationality, f.nationality) &&
          (!f.vip || p.vip === (f.vip === 'true')) &&
          (!f.inBlackList || p.inBlackList === (f.inBlackList === 'true'))
        );
      return contains(r.confirmationNumber, f.confirmationNumber) &&
        (!f.roomNumber || String(r.room?.roomNumber) === f.roomNumber) && (!f.rate || String(r.rate?.id) === f.rate) &&
        inRange(r.checkIn, f.checkInFrom, f.checkInTo) && inRange(r.checkOut, f.checkOutFrom, f.checkOutTo) &&
        inRange(r.createdAt, f.createdFrom, f.createdTo) &&
        contains(r.externalBookingNumber, f.externalBookingNumber) && contains(r.bookingSource, f.bookingSource) &&
        (!f.sourceCompany || String(r.sourceCompany?.id) === f.sourceCompany) &&
        (!f.operatorCompany || String(r.operatorCompany?.id) === f.operatorCompany) &&
        contains(r.status, f.status) && guestMatches;
    }));
  }

  clearFilters(): void {
    (Object.keys(this.filters) as (keyof SearchFilters)[]).forEach(key => this.filters[key] = '');
    this.applyFilters();
  }

  openCalendar(kind: 'checkIn' | 'checkOut' | 'created'): void {
    this.calendarOpen.set(this.calendarOpen() === kind ? null : kind);
    this.selectingEnd = false;
    const start = this.filters[`${kind}From` as keyof SearchFilters] as string;
    if (start) {
      const [year, month] = start.split('-').map(Number);
      this.calendarMonth.set(new Date(year, month - 1, 1));
    } else this.calendarMonth.set(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    this.updateCalendarDays();
  }

  shiftCalendarMonth(amount: number): void {
    const month = this.calendarMonth();
    this.calendarMonth.set(new Date(month.getFullYear(), month.getMonth() + amount, 1));
    this.updateCalendarDays();
  }

  selectCalendarDate(iso: string): void {
    const kind = this.calendarOpen();
    if (!kind) return;
    const fromKey = `${kind}From` as keyof SearchFilters;
    const toKey = `${kind}To` as keyof SearchFilters;
    if (!this.selectingEnd || !this.filters[fromKey] || iso < this.filters[fromKey]) {
      this.filters[fromKey] = iso;
      this.filters[toKey] = '';
      this.selectingEnd = true;
    } else {
      this.filters[toKey] = iso;
      this.selectingEnd = false;
      this.calendarOpen.set(null);
    }
    this.applyFilters();
  }

  rangeLabel(kind: 'checkIn' | 'checkOut' | 'created'): string {
    const from = this.filters[`${kind}From` as keyof SearchFilters];
    const to = this.filters[`${kind}To` as keyof SearchFilters];
    return from ? `${this.displayDate(from)}${to ? ` — ${this.displayDate(to)}` : ' — оберіть кінець'}` : 'Оберіть період';
  }

  isCalendarDateSelected(iso: string): boolean {
    const kind = this.calendarOpen();
    return !!kind && (iso === this.filters[`${kind}From` as keyof SearchFilters] || iso === this.filters[`${kind}To` as keyof SearchFilters]);
  }

  isCalendarDateInRange(iso: string): boolean {
    const kind = this.calendarOpen();
    if (!kind) return false;
    const from = this.filters[`${kind}From` as keyof SearchFilters];
    const to = this.filters[`${kind}To` as keyof SearchFilters];
    return !!from && !!to && iso > from && iso < to;
  }

  private updateCalendarDays(): void {
    const month = this.calendarMonth();
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    this.calendarDays.set(Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start); date.setDate(start.getDate() + i);
      return { date, iso: this.toIsoDate(date), currentMonth: date.getMonth() === month.getMonth() };
    }));
  }

  private toIsoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private displayDate(iso: string): string {
    const [year, month, day] = iso.split('-'); return `${day}.${month}.${year}`;
  }

  guestName(r: ReservationResponse): string {
    const p = r.primaryGuest;
    return p ? [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ') : r.guestName || '—';
  }

  openReservation(id: number): void { this.router.navigate(['/reservations', id]); }
}
