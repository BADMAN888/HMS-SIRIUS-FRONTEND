
import {
  Component,
  computed,
  effect,
  EventEmitter,
  inject,
  OnInit,
  Output,
  signal
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';

import { ProfileService } from '../../../../core/services/profile.service';
import {
  GuestProfileTarget,
  GuestProfileWorkflowService
} from '../../../../core/services/guest-profile-workflow.service';
import { RoomService } from '../../../../core/services/room.service';
import { RateService } from '../../../../core/services/rate.service';
import { RoomCategoryService } from '../../../../core/services/room-category.service';
import { CompanyService } from '../../../../core/services/company.service';
import { ReservationService } from '../../../../core/services/reservation.service';

import { ReservationResponse } from '../../../../core/models/reservation/reservation-response.model';
import { ProfileResponse } from '../../../../core/models/profile/profile-response.model';
import { RoomResponse } from '../../../../core/models/hotel/room-response.model';
import { RoomCategoryResponse } from '../../../../core/models/hotel/room-category-response.model';
import { RateResponse } from '../../../../core/models/billing/rate-response.model';
import { ReservationRequest } from '../../../../core/models/reservation/reservation-request.model';
import { ReservationCommentResponse } from '../../../../core/models/reservation/reservation-comment-response.model';
import { CompanyResponse } from '../../../../core/models/company-response.model';
import { TaxStatus } from '../../../../core/models/enums/tax-status.enum';
import { RoomStatus } from '../../../../core/models/enums/room-status.enum';
import { ReservationStatus } from '../../../../core/models/enums/reservation-status.enum';

@Component({
  selector: 'app-reservation-tab',
  standalone: true,
  imports: [
    FormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatOptionModule,
    MatSelectModule,
    DatePipe,
    DecimalPipe
  ],
  templateUrl: './reservation-tab.html',
  styleUrl: './reservation-tab.scss'
})
export class ReservationTab implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);

  private readonly reservationService = inject(ReservationService);
  private readonly profileService = inject(ProfileService);
  private readonly guestProfileWorkflow = inject(GuestProfileWorkflowService);
  private readonly roomService = inject(RoomService);
  private readonly rateService = inject(RateService);
  private readonly roomCategoryService = inject(RoomCategoryService);
  private readonly companyService = inject(CompanyService);

  readonly reservation = signal<ReservationResponse | null>(null);

  readonly isCreateMode = signal(false);
  readonly isCopyMode = signal(false);

  readonly profiles = signal<ProfileResponse[]>([]);
  readonly rooms = signal<RoomResponse[]>([]);
  readonly allReservations = signal<ReservationResponse[]>([]);
  readonly rates = signal<RateResponse[]>([]);
  readonly roomCategories = signal<RoomCategoryResponse[]>([]);
  readonly companies = signal<CompanyResponse[]>([]);

  readonly guestSearch = signal('');
  readonly guestPhoneSearch = signal('');
  readonly guestEmailSearch = signal('');
  readonly selectedGuest = signal<ProfileResponse | null>(null);

  readonly filteredProfiles = computed(() =>
    this.filterProfiles(this.guestSearch(), 'name')
  );

  readonly filteredProfilesByPhone = computed(() =>
    this.filterProfiles(this.guestPhoneSearch(), 'phone')
  );

  readonly filteredProfilesByEmail = computed(() =>
    this.filterProfiles(this.guestEmailSearch(), 'email')
  );

  readonly editRoomCategoryId = signal(0);
  readonly editPaymentCategoryId = signal(0);
  readonly editRoomId = signal(0);
  readonly editRoomLocked = signal(false);
  readonly editRateId = signal(0);
  readonly editPrimaryGuestId = signal(0);
  readonly editGuestIds = signal<number[]>([]);
  readonly editCheckIn = signal('');
  readonly editCheckOut = signal('');
  readonly stayPickerOpen = signal(false);
  readonly stayCalendarMonth = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly stayCalendarDays = computed(() => {
    const month = this.stayCalendarMonth();
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return { date: day, iso: this.formatIsoDate(day), currentMonth: day.getMonth() === month.getMonth() };
    });
  });
  readonly stayPeriodLabel = computed(() => {
    const start = this.editCheckIn();
    const end = this.editCheckOut();
    if (!start && !end) return 'Оберіть дати проживання';
    return `${this.formatStayDate(start)} ${start.slice(11, 16) || '14:00'} — ${this.formatStayDate(end)} ${end.slice(11, 16) || '12:00'}`;
  });
  readonly checkInTime = computed(() => this.editCheckIn().slice(11, 16) || '14:00');
  readonly checkOutTime = computed(() => this.editCheckOut().slice(11, 16) || '12:00');
  private stayDateSelection: 'checkIn' | 'checkOut' = 'checkIn';
  readonly editAdults = signal(1);
  readonly editChildren = signal(0);
  readonly editTaxStatus = signal<TaxStatus>(TaxStatus.RESIDENT);
  readonly autoComment = signal('');
  private paymentCategoryAutoSelected = false;
  private launchedFromGrid = false;

  readonly taxStatuses = TaxStatus;

  readonly editSourceCompanyId = signal<number | null>(null);
  readonly editOperatorCompanyId = signal<number | null>(null);
  readonly editBookingSource = signal('');
  readonly editExternalBookingNumber = signal('');

  readonly reservationNumberCopied = signal(false);

  readonly filteredRooms = computed(() => {
    const categoryId = this.editRoomCategoryId();
    const currentRoomId = this.editRoomId();
    const checkIn = this.editCheckIn();
    const checkOut = this.editCheckOut();
    return this.rooms().filter(room => {
      if (room.id === currentRoomId) return true;
      if ((categoryId && room.categoryId !== categoryId) || room.status !== RoomStatus.AVAILABLE) return false;
      if (!checkIn || !checkOut) return true;

      const overlaps = this.allReservations().filter(reservation =>
        reservation.room.id === room.id &&
        reservation.id !== this.reservation()?.id &&
        this.isActiveReservation(reservation) &&
        reservation.checkIn < checkOut && reservation.checkOut > checkIn
      );

      return overlaps.every(reservation =>
        !reservation.roomLocked &&
        (reservation.status === ReservationStatus.RESERVED ||
          reservation.status === ReservationStatus.CONFIRMED)
      );
    }).sort(
      (a, b) => Number(b.status === RoomStatus.AVAILABLE) - Number(a.status === RoomStatus.AVAILABLE)
    );
  });

  readonly loading = signal(true);
  readonly loadingEditData = signal(true);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly actionBusy = signal(false);

  readonly error = signal('');
  readonly saveError = signal('');

  readonly comments = signal<ReservationCommentResponse[]>([]);
  readonly newComment = signal('');
  readonly selectedCommentId = signal<number | null>(null);
  readonly commentsLoading = signal(false);
  readonly commentBusy = signal(false);

  readonly additionalGuestSearch = signal('');

  @Output() readonly createGuestProfile = new EventEmitter<{
    target: GuestProfileTarget;
    firstName: string;
    lastName: string;
    middleName: string;
    phoneNumber: string;
    email: string;
  }>();

  private handledCreatedProfileRequestId = 0;
  private handledRemovedProfileEventId = 0;
  private handledGuestListEventId = 0;

  private readonly createdProfileEffect = effect(() => {
    const event = this.guestProfileWorkflow.createdProfile();

    if (!event || event.requestId <= this.handledCreatedProfileRequestId) {
      return;
    }

    this.handledCreatedProfileRequestId = event.requestId;
    this.profiles.update(profiles => [
      ...profiles.filter(profile => profile.id !== event.profile.id),
      event.profile
    ]);

    if (event.target === 'primary') {
      this.selectPrimaryGuest(event.profile);
    } else {
      this.addAdditionalGuest(event.profile);
    }
  });

  private readonly removedDraftProfileEffect = effect(() => {
    const event = this.guestProfileWorkflow.removedDraftProfile();

    if (!event || event.eventId <= this.handledRemovedProfileEventId) {
      return;
    }

    this.handledRemovedProfileEventId = event.eventId;
    this.editGuestIds.update(ids => ids.filter(id => id !== event.profileId));

    if (this.editPrimaryGuestId() === event.profileId) {
      this.editPrimaryGuestId.set(0);
      this.selectedGuest.set(null);
      this.guestSearch.set('');
      this.guestPhoneSearch.set('');
      this.guestEmailSearch.set('');
    }
  });

  private readonly reservationGuestsEffect = effect(() => {
    const event = this.guestProfileWorkflow.reservationGuests();

    if (!event || event.eventId <= this.handledGuestListEventId) {
      return;
    }

    this.handledGuestListEventId = event.eventId;
    this.editPrimaryGuestId.set(event.primaryGuestId ?? 0);
    this.editGuestIds.set(event.guestIds.filter(id => id !== event.primaryGuestId));

    const primaryGuest = event.primaryGuestId === null
      ? undefined
      : this.getProfileById(event.primaryGuestId);
    if (primaryGuest) {
      this.selectPrimaryGuest(primaryGuest);
    }
  });

  readonly filteredAdditionalGuests = computed(() => {
    const query = this.additionalGuestSearch()
      .trim()
      .toLocaleLowerCase('uk-UA');

    if (query.length < 3) {
      return [];
    }

    const excludedIds = new Set([
      this.editPrimaryGuestId(),
      ...this.editGuestIds()
    ]);

    return this.profiles()
      .filter(profile => {
        if (excludedIds.has(profile.id)) {
          return false;
        }

        const name = this.getProfileFullName(profile)
          .toLocaleLowerCase('uk-UA');
        const phone = profile.phoneNumber ?? '';

        return name.includes(query) ||
          phone.toLocaleLowerCase().includes(query);
      })
      .slice(0, 10);
  });

  readonly hasPrimaryGuestDraft = computed(() =>
    Boolean(
      this.guestSearch().trim() ||
      this.guestPhoneSearch().trim() ||
      this.guestEmailSearch().trim()
    ) && !this.selectedGuest()
  );

  readonly hasAdditionalGuestMatch = computed(() => {
    const query = this.additionalGuestSearch().trim().toLocaleLowerCase('uk-UA');

    if (query.length < 3) {
      return false;
    }

    const normalizedQuery = query.replace(/\D/g, '');

    return this.profiles().some(profile => {
      const name = this.getProfileFullName(profile).toLocaleLowerCase('uk-UA');
      const phone = profile.phoneNumber ?? '';
      const normalizedPhone = phone.replace(/\D/g, '');

      return name.includes(query) ||
        phone.toLocaleLowerCase('uk-UA').includes(query) ||
        (normalizedQuery.length > 0 && normalizedPhone.includes(normalizedQuery));
    });
  });

  readonly filteredRates = computed(() => {
    const categoryId = this.editPaymentCategoryId();

    return this.rates().filter(rate => rate.categoryId === categoryId);
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : null;

    const copyFromParam = this.route.snapshot.queryParamMap.get('copyFrom');
    const copyFromId = copyFromParam ? Number(copyFromParam) : null;

    if (
      copyFromId !== null &&
      Number.isInteger(copyFromId) &&
      copyFromId > 0
    ) {
      this.isCreateMode.set(true);
      this.isCopyMode.set(true);
      this.loadDataAndReservation(copyFromId);
      return;
    }

    if (
      idParam &&
      Number.isInteger(id) &&
      id! > 0
    ) {
      this.loadDataAndReservation(id!);
      return;
    }

    if (idParam === 'new' || !idParam) {
      this.isCreateMode.set(true);
      this.loadCreateFormData();
      return;
    }

    this.error.set('Некоректний ID бронювання.');
    this.loading.set(false);
    this.loadingEditData.set(false);
  }

  getProfileFullName(profile: ProfileResponse): string {
    return [
      profile.lastName,
      profile.firstName,
      profile.middleName
    ].filter(Boolean).join(' ');
  }

  displayGuest = (profile: ProfileResponse | null): string =>
    profile ? this.getProfileFullName(profile) : '';

  private filterProfiles(
    value: string,
    field: 'name' | 'phone' | 'email'
  ): ProfileResponse[] {
    const query = value.trim().toLocaleLowerCase('uk-UA');

    if (query.length < 3) {
      return [];
    }

    return this.profiles()
      .filter(profile => {
        if (field === 'name') {
          return this.getProfileFullName(profile)
            .toLocaleLowerCase('uk-UA')
            .includes(query);
        }

        if (field === 'phone') {
          const phone = profile.phoneNumber ?? '';
          const normalizedPhone = phone.replace(/\D/g, '');
          const normalizedQuery = query.replace(/\D/g, '');

          return phone.toLocaleLowerCase('uk-UA').includes(query) ||
            (
              normalizedQuery.length > 0 &&
              normalizedPhone.includes(normalizedQuery)
            );
        }

        return (profile.email ?? '')
          .toLocaleLowerCase('uk-UA')
          .includes(query);
      })
      .slice(0, 10);
  }

  onGuestSearch(value: string): void {
    this.guestSearch.set(value);
    this.resetSelectedGuest();

    const normalized = this.normalizeName(value);
    const exactMatch = normalized
      ? this.profiles().find(
          profile => this.normalizeName(this.getProfileFullName(profile)) === normalized
        )
      : undefined;

    if (exactMatch) {
      this.selectPrimaryGuest(exactMatch);
    }
  }

  onGuestPhoneSearch(value: string): void {
    this.guestPhoneSearch.set(value);
    this.resetSelectedGuest();

    const normalizedPhone = value.replace(/\D/g, '');
    const exactMatch = normalizedPhone.length >= 7
      ? this.profiles().find(
          profile => (profile.phoneNumber ?? '').replace(/\D/g, '') === normalizedPhone
        )
      : undefined;

    if (exactMatch) {
      this.selectPrimaryGuest(exactMatch);
    }
  }

  onGuestEmailSearch(value: string): void {
    this.guestEmailSearch.set(value);
    this.resetSelectedGuest();

    const normalizedEmail = value.trim().toLocaleLowerCase('uk-UA');
    const exactMatch = normalizedEmail
      ? this.profiles().find(
          profile => (profile.email ?? '').trim().toLocaleLowerCase('uk-UA') === normalizedEmail
        )
      : undefined;

    if (exactMatch) {
      this.selectPrimaryGuest(exactMatch);
    }
  }

  onAdditionalGuestSearch(value: string): void {
    this.additionalGuestSearch.set(value);
    const query = value.trim();

    if (query.length < 3) {
      return;
    }

    const normalizedName = this.normalizeName(query);
    const normalizedPhone = query.replace(/\D/g, '');
    const exactMatch = this.profiles().find(profile =>
      this.normalizeName(this.getProfileFullName(profile)) === normalizedName ||
      (
        normalizedPhone.length >= 7 &&
        (profile.phoneNumber ?? '').replace(/\D/g, '') === normalizedPhone
      )
    );

    if (exactMatch) {
      this.addAdditionalGuest(exactMatch);
    }
  }

  private resetSelectedGuest(): void {
    this.selectedGuest.set(null);
    this.editPrimaryGuestId.set(0);
  }

  private normalizeName(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('uk-UA');
  }

  createPrimaryGuestProfile(): void {
    if (!this.hasPrimaryGuestDraft()) {
      return;
    }

    const name = this.guestSearch().trim().split(/\s+/).filter(Boolean);

    this.createGuestProfile.emit({
      target: 'primary',
      lastName: name[0] ?? '',
      firstName: name[1] ?? '',
      middleName: name.slice(2).join(' '),
      phoneNumber: this.guestPhoneSearch().trim(),
      email: this.guestEmailSearch().trim()
    });
  }

  createAdditionalGuestProfile(): void {
    const query = this.additionalGuestSearch().trim();

    if (query.length < 2) {
      return;
    }

    const digits = query.replace(/\D/g, '');
    const isPhone = digits.length >= 7 && digits.length / query.length > 0.5;
    const name = isPhone ? [] : query.split(/\s+/).filter(Boolean);

    this.createGuestProfile.emit({
      target: 'additional',
      lastName: name[0] ?? '',
      firstName: name[1] ?? '',
      middleName: name.slice(2).join(' '),
      phoneNumber: isPhone ? query : '',
      email: ''
    });
  }

  selectPrimaryGuest(profile: ProfileResponse): void {
    this.selectedGuest.set(profile);
    this.editPrimaryGuestId.set(profile.id);
    this.guestSearch.set(this.getProfileFullName(profile));
    this.guestPhoneSearch.set(profile.phoneNumber ?? '');
    this.guestEmailSearch.set(profile.email ?? '');
  }

  private loadCreateFormData(): void {
    this.loading.set(true);
    this.loadingEditData.set(true);
    this.error.set('');

    forkJoin({
      profiles: this.profileService.getAll(),
      rates: this.rateService.getAll(),
      roomCategories: this.roomCategoryService.getAll(),
      companies: this.companyService.getAll(),
      rooms: this.roomService.getAll(),
      reservations: this.reservationService.getAll()
    }).pipe(
      finalize(() => {
        this.loading.set(false);
        this.loadingEditData.set(false);
      })
    ).subscribe({
      next: data => {
        this.profiles.set(data.profiles);
        this.rates.set(data.rates);
        this.roomCategories.set(data.roomCategories);
        this.companies.set(data.companies.filter(company => company.active));
        this.rooms.set(data.rooms);
        this.allReservations.set(data.reservations);

        this.reservation.set(null);
        this.comments.set([]);

        this.editRoomCategoryId.set(0);
        this.editPaymentCategoryId.set(0);
        this.editRoomId.set(0);
        this.editRoomLocked.set(false);
        this.editRateId.set(0);
        this.editPrimaryGuestId.set(0);
        this.editGuestIds.set([]);

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        this.editCheckIn.set(`${this.formatIsoDate(today)}T14:00`);
        this.editCheckOut.set(`${this.formatIsoDate(tomorrow)}T12:00`);
        this.editAdults.set(1);
        this.editChildren.set(0);
        this.editTaxStatus.set(TaxStatus.RESIDENT);

        this.editSourceCompanyId.set(null);
        this.editOperatorCompanyId.set(null);
        this.editBookingSource.set('');
        this.editExternalBookingNumber.set('');
        this.autoComment.set('');
        this.paymentCategoryAutoSelected = false;
        this.launchedFromGrid = false;

        this.selectedGuest.set(null);
        this.guestSearch.set('');
        this.guestPhoneSearch.set('');
        this.guestEmailSearch.set('');

        this.additionalGuestSearch.set('');

        this.newComment.set('');
        this.selectedCommentId.set(null);

        const query = this.route.snapshot.queryParamMap;
        const roomId = Number(query.get('roomId'));
        const room = this.rooms().find(item => item.id === roomId);
        if (room) {
          this.launchedFromGrid = true;
          this.editRoomId.set(room.id);
          this.editRoomCategoryId.set(room.categoryId ?? 0);
          this.editPaymentCategoryId.set(room.categoryId ?? 0);
          this.paymentCategoryAutoSelected = true;
          this.selectFirstRate(room.categoryId ?? 0);
        }
        const checkIn = query.get('checkIn');
        const checkOut = query.get('checkOut');
        if (checkIn) this.editCheckIn.set(this.toDateTimeLocal(checkIn));
        if (checkOut) this.editCheckOut.set(this.toDateTimeLocal(checkOut));
      },
      error: error => {
        this.error.set(
          error?.error?.message ||
          error?.message ||
          `Не вдалося завантажити дані форми. HTTP ${error?.status || ''}`
        );
      }
    });
  }

  private loadDataAndReservation(id: number): void {
    this.loading.set(true);
    this.loadingEditData.set(true);
    this.error.set('');
    this.saveError.set('');
    this.saved.set(false);

    forkJoin({
      reservation: this.reservationService.getById(id),
      profiles: this.profileService.getAll(),
      rates: this.rateService.getAll(),
      roomCategories: this.roomCategoryService.getAll(),
      companies: this.companyService.getAll(),
      allRooms: this.roomService.getAll(),
      reservations: this.reservationService.getAll()
    }).pipe(
      finalize(() => {
        this.loading.set(false);
        this.loadingEditData.set(false);
      })
    ).subscribe({
      next: data => {
        this.profiles.set(data.profiles);
        this.rates.set(data.rates);
        this.roomCategories.set(data.roomCategories);
        this.companies.set(data.companies.filter(company => company.active));
        this.rooms.set(data.allRooms);
        this.allReservations.set(data.reservations);

        this.reservation.set(data.reservation);
        this.initializeForm(data.reservation);

        if (this.isCopyMode()) {
          this.comments.set([]);
          this.newComment.set('');
          this.selectedCommentId.set(null);
          this.editExternalBookingNumber.set('');
        }
      },
      error: error => {
        this.error.set(
          error?.error?.message ||
          error?.message ||
          `Не вдалося завантажити дані бронювання. HTTP ${error?.status || ''}`
        );
      }
    });
  }

  private initializeForm(reservation: ReservationResponse): void {
    const roomId = reservation.room?.id ?? (reservation as any).roomId ?? 0;

    const roomCategoryId =
      reservation.room?.categoryId ??
      (reservation as any).roomCategoryId ??
      0;

    this.editRoomId.set(roomId);
    this.editRoomLocked.set(this.isCopyMode() ? false : reservation.roomLocked);

    if (roomCategoryId) {
      this.editRoomCategoryId.set(roomCategoryId);
    } else if (roomId) {
      const foundRoom = this.rooms().find(room => room.id === roomId);

      if (foundRoom?.categoryId != null) {
        this.editRoomCategoryId.set(foundRoom.categoryId);
      } else {
        this.roomService.getById(roomId).subscribe({
          next: room => {
            if (room?.categoryId) {
              this.editRoomCategoryId.set(room.categoryId);

              if (!this.rooms().some(item => item.id === room.id)) {
                this.rooms.update(items => [...items, room]);
              }
            }
          }
        });
      }
    }

    this.editPaymentCategoryId.set(reservation.paymentCategoryId ?? 0);

    this.editRateId.set(
      reservation.rate?.id ?? (reservation as any).rateId ?? 0
    );

    this.editPrimaryGuestId.set(reservation.primaryGuest?.id ?? 0);
    this.editGuestIds.set([...(reservation.guestIds ?? [])]);

    this.editCheckIn.set(this.toDateTimeLocal(reservation.checkIn));
    this.editCheckOut.set(this.toDateTimeLocal(reservation.checkOut));

    this.editAdults.set(reservation.adults ?? 1);
    this.editChildren.set(reservation.children ?? 0);
    this.editTaxStatus.set(reservation.taxStatus ?? TaxStatus.RESIDENT);

    this.editSourceCompanyId.set(reservation.sourceCompany?.id ?? null);
    this.editOperatorCompanyId.set(reservation.operatorCompany?.id ?? null);
    this.editBookingSource.set(reservation.bookingSource ?? '');

    this.editExternalBookingNumber.set(
      reservation.externalBookingNumber ?? ''
    );

    this.comments.set(reservation.comments ?? []);
    this.selectedCommentId.set(null);

    if (reservation.primaryGuest) {
      this.selectedGuest.set(reservation.primaryGuest);
      this.guestSearch.set(this.getProfileFullName(reservation.primaryGuest));
      this.guestPhoneSearch.set(reservation.primaryGuest.phoneNumber ?? '');
      this.guestEmailSearch.set(reservation.primaryGuest.email ?? '');
    } else {
      this.selectedGuest.set(null);
      this.guestSearch.set('');
      this.guestPhoneSearch.set('');
      this.guestEmailSearch.set('');
    }
  }

  private toDateTimeLocal(value: string): string {
    return value ? value.slice(0, 16) : '';
  }

  private toLocalDateTime(value: string): string {
    return value.length === 16 ? `${value}:00` : value;
  }

  toggleStayPicker(): void {
    if (!this.stayPickerOpen()) {
      const current = this.editCheckIn() || this.editCheckOut();
      if (current) {
        const [year, month] = current.slice(0, 10).split('-').map(Number);
        this.stayCalendarMonth.set(new Date(year, month - 1, 1));
      }
      this.stayDateSelection = this.editCheckIn() && !this.editCheckOut() ? 'checkOut' : 'checkIn';
    }
    this.stayPickerOpen.update(open => !open);
  }

  shiftStayMonth(offset: number): void {
    const month = this.stayCalendarMonth();
    this.stayCalendarMonth.set(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }

  selectStayDate(iso: string): void {
    const selection = this.stayDateSelection;
    if (selection === 'checkIn') {
      const time = this.checkInTime();
      this.editCheckIn.set(`${iso}T${time}`);
      const end = this.editCheckOut();
      if (end && end.slice(0, 10) <= iso) this.editCheckOut.set('');
      this.stayDateSelection = 'checkOut';
      return;
    }

    const start = this.editCheckIn();
    if (start && iso < start.slice(0, 10)) {
      this.editCheckIn.set(`${iso}T${this.checkInTime()}`);
      this.editCheckOut.set('');
      this.stayDateSelection = 'checkOut';
      return;
    }
    this.editCheckOut.set(`${iso}T${this.checkOutTime()}`);
    this.stayDateSelection = 'checkIn';
  }

  isStayDateSelected(iso: string): boolean {
    return iso === this.editCheckIn().slice(0, 10) || iso === this.editCheckOut().slice(0, 10);
  }

  isStayDateInRange(iso: string): boolean {
    const start = this.editCheckIn().slice(0, 10);
    const end = this.editCheckOut().slice(0, 10);
    return Boolean(start && end && iso > start && iso < end);
  }

  setStayTime(which: 'checkIn' | 'checkOut', value: string): void {
    const isCheckIn = which === 'checkIn';
    const current = isCheckIn ? this.editCheckIn() : this.editCheckOut();
    const date = current.slice(0, 10);
    const next = date ? `${date}T${value}` : '';
    if (isCheckIn) this.editCheckIn.set(next);
    else this.editCheckOut.set(next);
  }

  private formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatStayDate(value: string): string {
    if (!value) return '—';
    const [year, month, day] = value.slice(0, 10).split('-');
    return `${day}.${month}.${year}`;
  }

  onRoomCategoryChange(categoryId: number | null): void {
    if (
      categoryId === null ||
      this.editRoomCategoryId() === categoryId
    ) {
      return;
    }

    this.editRoomCategoryId.set(categoryId);
    if (this.launchedFromGrid || !this.paymentCategoryAutoSelected) {
      this.editPaymentCategoryId.set(categoryId);
      this.paymentCategoryAutoSelected = true;
    }
    const room = this.rooms()
      .filter(item => item.categoryId === categoryId)
      .sort(
        (a, b) => Number(b.status === RoomStatus.AVAILABLE) - Number(a.status === RoomStatus.AVAILABLE)
      )[0];
    this.editRoomId.set(room?.id ?? 0);
    this.selectFirstRate(this.editPaymentCategoryId());
    this.saveError.set('');
  }

  private selectFirstRate(categoryId: number): void {
    const firstRate = this.rates().find(
      rate => rate.categoryId === categoryId && rate.active
    );
    this.editRateId.set(firstRate?.id ?? 0);
  }

  onPaymentCategoryChange(categoryId: number): void {
    this.editPaymentCategoryId.set(categoryId);
  }

  onRoomChange(roomId: number): void {
    this.editRoomId.set(roomId);

    const room = this.rooms().find(item => item.id === roomId);

    if (
      room?.categoryId &&
      room.categoryId !== this.editRoomCategoryId()
    ) {
      this.editRoomCategoryId.set(room.categoryId);
    }
  }

  toggleRoomLock(): void {
    this.editRoomLocked.update(locked => !locked);
  }

  private isActiveReservation(reservation: ReservationResponse): boolean {
    return reservation.status !== ReservationStatus.CANCELLED &&
      reservation.status !== ReservationStatus.COMPLETED &&
      reservation.status !== ReservationStatus.NO_SHOW;
  }

  save(): void {
    const reservation = this.reservation();

    if (
      (!this.isCreateMode() && !reservation) ||
      this.saving()
    ) {
      return;
    }

    if (this.loadingEditData()) {
      this.saveError.set('Зачекайте, поки завантажаться дані форми.');
      return;
    }

    const missingFields: string[] = [];

    if (!this.editRoomCategoryId()) {
      missingFields.push('категорії номера');
    }

    if (!this.editPaymentCategoryId()) {
      missingFields.push('категорії оплати');
    }

    if (!this.editRoomId()) {
      missingFields.push('номера кімнати');
    }

    if (!this.editRateId()) {
      missingFields.push('тарифу');
    }

    if (!this.editCheckIn()) {
      missingFields.push('дати заїзду');
    }

    if (!this.editCheckOut()) {
      missingFields.push('дати виїзду');
    }

    if (this.editAdults() < 1) {
      missingFields.push('кількості дорослих');
    }

    if (this.editChildren() < 0) {
      missingFields.push('кількості дітей');
    }

    if (missingFields.length > 0) {
      this.saveError.set(
        `Заповніть обов’язкові поля: ${missingFields.join(', ')}.`
      );
      return;
    }

    const checkIn = this.editCheckIn();
    const checkInTime = new Date(checkIn).getTime();
    const checkOutTime = new Date(this.editCheckOut()).getTime();

    if (
      !Number.isFinite(checkInTime) ||
      !Number.isFinite(checkOutTime) ||
      checkOutTime <= checkInTime
    ) {
      this.saveError.set('Дата виїзду має бути пізніше дати заїзду.');
      return;
    }

    this.saving.set(true);
    this.saved.set(false);
    this.saveError.set('');

    const guestIds = Array.from(new Set([
      ...this.editGuestIds(),
      ...(this.editPrimaryGuestId() ? [this.editPrimaryGuestId()] : [])
    ]));

    const request: ReservationRequest = {
      roomId: this.editRoomId(),
      rateId: this.editRateId(),
      paymentCategoryId: this.editPaymentCategoryId(),
      primaryGuestId: this.editPrimaryGuestId() || null,
      roomLocked: this.editRoomLocked(),
      guestIds,
      checkIn: this.toLocalDateTime(checkIn),
      checkOut: this.toLocalDateTime(this.editCheckOut()),
      adults: this.editAdults(),
      children: this.editChildren(),
      taxStatus: this.editTaxStatus(),
      bookingSource: this.editBookingSource().trim() || null,
      sourceCompanyId: this.editSourceCompanyId(),
      operatorCompanyId: this.editOperatorCompanyId(),
      externalBookingNumber:
        this.editExternalBookingNumber().trim() || null
    };

    const saveRequest = this.isCreateMode()
      ? this.reservationService.create(request)
      : this.reservationService.update(reservation!.id, request);

    saveRequest.pipe(
      switchMap(savedReservation => {
        const comment = this.autoComment().trim();
        if (this.isCreateMode() && comment) {
          return this.reservationService.createComment(
            savedReservation.id,
            { text: comment }
          ).pipe(
            map(() => savedReservation),
            catchError(error => {
              this.saveError.set(error?.error?.message || 'Бронювання створене, але коментар не вдалося зберегти.');
              return of(savedReservation);
            })
          );
        }
        return of(savedReservation);
      }),
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: savedReservation => {
        this.autoComment.set('');
        this.reservation.set(savedReservation);
        this.isCreateMode.set(false);
        this.isCopyMode.set(false);

        this.initializeForm(savedReservation);
        this.saved.set(true);

        this.router.navigate(['/reservations', savedReservation.id]);
      },
      error: error => {
        this.saveError.set(
          error?.error?.message ||
          error?.message ||
          `Не вдалося зберегти бронювання. HTTP ${error?.status || ''}`
        );
      }
    });
  }

  copyReservation(): void {
    const reservation = this.reservation();

    if (!reservation) {
      return;
    }

    this.router.navigate(['/reservations', 'new'], {
      queryParams: {
        copyFrom: reservation.id
      }
    });
  }

  cancelReservation(): void {
    this.runLifecycleAction('cancel');
  }

  markNoShow(): void {
    this.runLifecycleAction('no-show');
  }

  canCheckIn(): boolean {
    const reservation = this.reservation();
    return !!reservation &&
      this.isToday(reservation.checkIn) &&
      (reservation.status === ReservationStatus.RESERVED ||
        reservation.status === ReservationStatus.CONFIRMED);
  }

  canMarkNoShow(): boolean {
    const reservation = this.reservation();
    return !!reservation &&
      this.isBeforeToday(reservation.checkIn) &&
      (reservation.status === ReservationStatus.RESERVED ||
        reservation.status === ReservationStatus.CONFIRMED);
  }

  checkInReservation(): void {
    const reservation = this.reservation();
    if (!reservation || !this.canCheckIn() || this.actionBusy()) return;

    this.actionBusy.set(true);
    this.saveError.set('');
    this.reservationService.checkIn(reservation.id).pipe(
      finalize(() => this.actionBusy.set(false))
    ).subscribe({
      next: () => this.loadDataAndReservation(reservation.id),
      error: error => this.saveError.set(
        error?.error?.message || error?.message ||
        `Не вдалося зареєструвати заїзд. HTTP ${error?.status || ''}`
      )
    });
  }

  private isToday(value: string): boolean {
    return this.toLocalDateKey(value) === this.toLocalDateKey(new Date().toISOString());
  }

  private isBeforeToday(value: string): boolean {
    return this.toLocalDateKey(value) < this.toLocalDateKey(new Date().toISOString());
  }

  private toLocalDateKey(value: string): string {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private runLifecycleAction(action: 'cancel' | 'no-show'): void {
    const reservation = this.reservation();

    if (!reservation || this.actionBusy()) {
      return;
    }

    const message = action === 'cancel'
      ? 'Скасувати це бронювання?'
      : 'Позначити гостя як такого, що не заїхав?';

    if (!window.confirm(message)) {
      return;
    }

    this.actionBusy.set(true);
    this.saveError.set('');

    const request = action === 'cancel'
      ? this.reservationService.cancel(reservation.id)
      : this.reservationService.noShow(reservation.id);

    request.pipe(
      finalize(() => this.actionBusy.set(false))
    ).subscribe({
      next: () => this.loadDataAndReservation(reservation.id),
      error: error => {
        this.saveError.set(
          error?.error?.message ||
          error?.message ||
          'Не вдалося оновити статус бронювання.'
        );
      }
    });
  }

  onGuestIdsChange(event: Event): void {
    const select = event.target as HTMLSelectElement;

    this.editGuestIds.set(
      Array.from(select.selectedOptions).map(option => Number(option.value))
    );
  }

  addAdditionalGuest(profile: ProfileResponse): void {
    if (
      profile.id === this.editPrimaryGuestId() ||
      this.editGuestIds().includes(profile.id)
    ) {
      return;
    }

    this.editGuestIds.update(ids => [...ids, profile.id]);
    this.additionalGuestSearch.set('');
  }

  removeAdditionalGuest(profileId: number): void {
    this.editGuestIds.update(ids =>
      ids.filter(id => id !== profileId)
    );
  }

  getProfileById(id: number): ProfileResponse | undefined {
    return this.profiles().find(profile => profile.id === id);
  }

  loadComments(): void {
    const reservation = this.reservation();

    if (!reservation) {
      return;
    }

    this.commentsLoading.set(true);

    this.reservationService.getComments(reservation.id)
      .pipe(finalize(() => this.commentsLoading.set(false)))
      .subscribe({
        next: comments => this.comments.set(comments),
        error: error => {
          this.saveError.set(
            error?.error?.message ||
            'Не вдалося завантажити коментарі.'
          );
        }
      });
  }

  addComment(): void {
    const reservation = this.reservation();
    const text = this.newComment().trim();

    if (!reservation || !text || this.commentBusy()) {
      return;
    }

    this.commentBusy.set(true);

    this.reservationService.createComment(reservation.id, { text })
      .pipe(finalize(() => this.commentBusy.set(false)))
      .subscribe({
        next: comment => {
          this.comments.update(items => [...items, comment]);
          this.newComment.set('');
          this.selectedCommentId.set(comment.id);
        },
        error: error => {
          this.saveError.set(
            error?.error?.message ||
            'Не вдалося додати коментар.'
          );
        }
      });
  }

  deleteSelectedComment(): void {
    const reservation = this.reservation();
    const commentId = this.selectedCommentId();

    if (
      !reservation ||
      commentId === null ||
      this.commentBusy()
    ) {
      return;
    }

    if (!window.confirm('Видалити вибраний коментар?')) {
      return;
    }

    this.commentBusy.set(true);

    this.reservationService.deleteComment(reservation.id, commentId)
      .pipe(finalize(() => this.commentBusy.set(false)))
      .subscribe({
        next: () => {
          this.comments.update(items =>
            items.filter(item => item.id !== commentId)
          );
          this.selectedCommentId.set(null);
        },
        error: error => {
          this.saveError.set(
            error?.error?.message ||
            'Не вдалося видалити коментар.'
          );
        }
      });
  }

  decreaseAdults(): void {
    this.editAdults.update(current => Math.max(1, current - 1));
  }

  increaseAdults(): void {
    this.editAdults.update(current => current + 1);
  }

  decreaseChildren(): void {
    this.editChildren.update(current => Math.max(0, current - 1));
  }

  increaseChildren(): void {
    this.editChildren.update(current => current + 1);
  }

  async copyReservationNumber(): Promise<void> {
    const confirmationNumber = this.reservation()?.confirmationNumber;

    if (confirmationNumber == null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(String(confirmationNumber));
      this.reservationNumberCopied.set(true);

      setTimeout(() => {
        this.reservationNumberCopied.set(false);
      }, 5000);
    } catch (error) {
      console.error('Не вдалося скопіювати номер бронювання:', error);
    }
  }
}
