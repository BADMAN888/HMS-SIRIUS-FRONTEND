import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { GroupBookingCreateRequest, GroupBookingDetails, GroupBookingRoomRequest, GroupBookingSummary } from '../../core/models/reservation/group-booking.model';
import { HotelResponse } from '../../core/models/hotel/hotel-response.model';
import { RoomResponse } from '../../core/models/hotel/room-response.model';
import { RoomCategoryResponse } from '../../core/models/hotel/room-category-response.model';
import { RateResponse } from '../../core/models/billing/rate-response.model';
import { ProfileResponse } from '../../core/models/profile/profile-response.model';
import { RoomStatus } from '../../core/models/enums/room-status.enum';
import { GroupBookingService } from '../../core/services/group-booking.service';
import { HotelService } from '../../core/services/hotel.service';
import { RoomService } from '../../core/services/room.service';
import { RoomCategoryService } from '../../core/services/room-category.service';
import { RateService } from '../../core/services/rate.service';
import { ProfileService } from '../../core/services/profile.service';

interface RoomLine {
  roomId: number;
  rateId: number;
  primaryGuestId: number | null;
  guestName: string;
  adults: number;
  children: number;
  roomLocked: boolean;
  profileSearch: string;
  profileResults: ProfileResponse[];
  profileSearchRevision: number;
}

@Component({
  selector: 'app-groups', standalone: true,
  imports: [FormsModule, CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './groups.html', styleUrl: './groups.scss'
})
export class Groups implements OnInit {
  private readonly groupsApi = inject(GroupBookingService);
  private readonly hotelApi = inject(HotelService);
  private readonly roomApi = inject(RoomService);
  private readonly categoryApi = inject(RoomCategoryService);
  private readonly rateApi = inject(RateService);
  private readonly profileApi = inject(ProfileService);

  readonly hotels = signal<HotelResponse[]>([]);
  readonly hotelId = signal<number | null>(null);
  readonly rooms = signal<RoomResponse[]>([]);
  readonly categories = signal<RoomCategoryResponse[]>([]);
  readonly rates = signal<RateResponse[]>([]);
  readonly pageContent = signal<GroupBookingSummary[]>([]);
  readonly selected = signal<GroupBookingDetails | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly createOpen = signal(false);

  query = '';
  fromDate = '';
  toDate = '';
  groupName = '';
  organizerName = '';
  contactPhone = '';
  contactEmail = '';
  checkIn = '';
  checkOut = '';
  notes = '';
  externalBookingNumber = '';
  bookingSource = '';
  roomLines: RoomLine[] = [];
  selectedRoomId = '';

  get guestCount(): number {
    return this.roomLines.reduce((sum, line) => sum + Number(line.adults || 0) + Number(line.children || 0), 0);
  }

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({ hotels: this.hotelApi.getAll(), rooms: this.roomApi.getAll(), rates: this.rateApi.getAll() }).subscribe({
      next: data => {
        const hotelList = data.hotels ?? [];
        this.hotels.set(hotelList);
        this.rooms.set(data.rooms ?? []);
        this.rates.set(data.rates ?? []);
        if (hotelList.length) {
          this.hotelId.set(hotelList[0].id);
          this.loadHotelCategories(hotelList[0].id);
        }
        this.loading.set(false);
        this.loadGroups(0);
      },
      error: err => { this.loading.set(false); this.error.set(err?.error?.message || 'Не вдалося завантажити дані вкладки груп.'); }
    });
  }

  loadHotelCategories(id: number): void {
    this.categoryApi.getAllByHotelId(id).subscribe({ next: items => this.categories.set(items), error: err => this.fail(err) });
  }

  changeHotel(value: string): void {
    const id = Number(value) || null;
    this.hotelId.set(id);
    this.categories.set([]);
    this.selected.set(null);
    if (id) this.loadHotelCategories(id);
    this.loadGroups(0);
  }

  loadGroups(page: number): void {
    this.loading.set(true);
    this.groupsApi.search(this.query, this.fromDate, this.toDate, page, this.hotelId()).subscribe({
      next: result => { this.pageContent.set(result.content); this.page.set(result.page); this.totalPages.set(result.totalPages); this.totalElements.set(result.totalElements); this.loading.set(false); },
      error: err => { this.loading.set(false); this.fail(err); }
    });
  }

  openDetails(group: GroupBookingSummary): void {
    this.selected.set(null);
    this.loading.set(true);
    this.groupsApi.get(group.id).subscribe({ next: details => { this.selected.set(details); this.loading.set(false); }, error: err => { this.loading.set(false); this.fail(err); } });
  }

  eligibleRooms(): RoomResponse[] {
    const hotelId = this.hotelId();
    const added = new Set(this.roomLines.map(line => line.roomId));
    return this.rooms().filter(room => room.hotelId === hotelId && room.status === RoomStatus.AVAILABLE && room.clean && !added.has(room.id));
  }

  roomLabel(room: RoomResponse): string {
    const category = this.categories().find(item => item.id === room.categoryId);
    return `№${room.roomNumber} · ${category?.name ?? 'Категорія'}`;
  }

  roomLabelById(roomId: number): string {
    const room = this.rooms().find(item => item.id === roomId);
    return room ? this.roomLabel(room) : `Номер №${roomId}`;
  }

  addRoom(): void {
    const roomId = Number(this.selectedRoomId);
    const room = this.eligibleRooms().find(item => item.id === roomId);
    if (!room) return;
    const rate = this.rates().find(item => item.active && item.categoryId === room.categoryId);
    this.roomLines = [...this.roomLines, { roomId, rateId: rate?.id ?? 0, primaryGuestId: null, guestName: '', adults: 1, children: 0, roomLocked: false, profileSearch: '', profileResults: [], profileSearchRevision: 0 }];
    this.selectedRoomId = '';
  }

  removeRoom(roomId: number): void { this.roomLines = this.roomLines.filter(line => line.roomId !== roomId); }

  guestChanged(line: RoomLine, value: string): void {
    const id = Number(value) || null;
    line.primaryGuestId = id;
    const profile = line.profileResults.find(item => item.id === id);
    if (profile) {
      line.guestName = [profile.lastName, profile.firstName, profile.middleName].filter(Boolean).join(' ');
      line.profileSearch = line.guestName;
      line.profileResults = [];
    }
  }

  searchLineProfiles(line: RoomLine): void {
    const query = line.profileSearch.trim();
    const revision = ++line.profileSearchRevision;
    if (query.length < 2) { line.profileResults = []; return; }
    const tokens = query.split(/\s+/);
    const requests = query.includes('@')
      ? [this.profileApi.search({ email: query }, 0)]
      : query.replace(/\D/g, '').length >= 5
        ? [this.profileApi.search({ phone: query }, 0)]
        : tokens.length > 1
          ? [this.profileApi.search({ firstName: tokens[0], lastName: tokens.slice(1).join(' ') }, 0), this.profileApi.search({ lastName: tokens[0], firstName: tokens.slice(1).join(' ') }, 0)]
          : [this.profileApi.search({ firstName: query }, 0), this.profileApi.search({ lastName: query }, 0)];
    forkJoin(requests).subscribe({ next: pages => {
      if (line.profileSearchRevision !== revision) return;
      const unique = new Map<number, ProfileResponse>();
      pages.forEach(page => page.content.forEach(profile => unique.set(profile.id, profile)));
      line.profileResults = [...unique.values()].slice(0, 20);
    }, error: err => this.fail(err) });
  }

  selectLineProfile(line: RoomLine, profile: ProfileResponse): void {
    line.primaryGuestId = profile.id;
    line.guestName = [profile.lastName, profile.firstName, profile.middleName].filter(Boolean).join(' ');
    line.profileSearch = line.guestName;
    line.profileResults = [];
  }

  ratesForRoom(roomId: number): RateResponse[] {
    const room = this.rooms().find(item => item.id === roomId);
    return this.rates().filter(rate => rate.active && rate.categoryId === room?.categoryId);
  }

  submitGroup(): void {
    const hotelId = this.hotelId();
    if (!hotelId || !this.groupName.trim() || !this.checkIn || !this.checkOut || !this.roomLines.length) {
      this.error.set('Заповніть назву групи, дати та додайте хоча б один номер.'); return;
    }
    if (this.roomLines.some(line => !line.rateId || !line.guestName.trim() || line.adults < 1)) {
      this.error.set('Для кожного номера виберіть тариф, вкажіть ім’я гостя й кількість дорослих.'); return;
    }
    const reservations: GroupBookingRoomRequest[] = this.roomLines.map(line => {
      const guestIds = line.primaryGuestId ? [line.primaryGuestId] : [];
      return { roomId: line.roomId, rateId: line.rateId, paymentCategoryId: this.rooms().find(room => room.id === line.roomId)?.categoryId ?? 0,
        primaryGuestId: line.primaryGuestId, guestIds, adults: Number(line.adults), children: Number(line.children), roomLocked: line.roomLocked, guestName: line.guestName.trim() };
    });
    const request: GroupBookingCreateRequest = {
      hotelId, groupName: this.groupName.trim(), organizerName: this.organizerName.trim(), contactPhone: this.contactPhone.trim(),
      contactEmail: this.contactEmail.trim() || null, checkIn: this.toDateTime(this.checkIn), checkOut: this.toDateTime(this.checkOut), notes: this.notes.trim(),
      externalBookingNumber: this.externalBookingNumber.trim(), bookingSource: this.bookingSource.trim(), taxStatus: 'RESIDENT', reservations
    };
    this.saving.set(true); this.error.set(''); this.notice.set('');
    this.groupsApi.create(request).subscribe({
      next: details => {
        this.saving.set(false); this.createOpen.set(false); this.resetForm(); this.notice.set(`Групу ${details.group.reference} створено з ${details.group.reservationCount} бронювань.`);
        this.loadGroups(0); this.selected.set(details);
      },
      error: err => { this.saving.set(false); this.fail(err); }
    });
  }

  resetForm(): void {
    this.groupName = ''; this.organizerName = ''; this.contactPhone = ''; this.contactEmail = ''; this.checkIn = ''; this.checkOut = ''; this.notes = ''; this.externalBookingNumber = ''; this.bookingSource = ''; this.roomLines = [];
  }

  pageNumbers(): number[] {
    const total = this.totalPages(), start = Math.max(0, Math.min(this.page() - 2, total - 5));
    return Array.from({ length: Math.min(5, total) }, (_, index) => start + index);
  }

  statusLabel(status: string): string {
    return ({ CONFIRMED: 'Підтверджена', IN_HOUSE: 'Проживає', PARTIAL: 'Частково завершена', COMPLETED: 'Завершена', CANCELLED: 'Скасована' } as Record<string, string>)[status] ?? status;
  }

  private toDateTime(value: string): string { return value.length === 16 ? `${value}:00` : value; }
  private fail(error: any): void { this.error.set(error?.error?.message || error?.message || 'Сталася помилка під час роботи з групою.'); }
}
