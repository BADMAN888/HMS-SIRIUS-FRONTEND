import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { AccrualRequest } from '../../../../core/models/billing/accrual-request.model';
import { AccrualResponse } from '../../../../core/models/billing/accrual-response.model';
import { FacilityResponse } from '../../../../core/models/billing/facility-response.model';
import { FolioResponse } from '../../../../core/models/billing/folio-response.model';
import { LegalEntityResponse } from '../../../../core/models/legal-entity-response.model';
import { PaymentRequest } from '../../../../core/models/billing/payment-request.model';
import { FolioPartiesRequest } from '../../../../core/models/billing/folio-parties-request.model';
import { FolioRequest } from '../../../../core/models/billing/folio-request.model';
import { FolioReopenRequest } from '../../../../core/models/billing/folio-reopen-request.model';
import { FacilityType } from '../../../../core/models/enums/facility-type.enum';
import { FolioStatus } from '../../../../core/models/enums/folio-status.enum';
import { ProfileResponse } from '../../../../core/models/profile/profile-response.model';
import { ReservationResponse } from '../../../../core/models/reservation/reservation-response.model';

import { AccrualService } from '../../../../core/services/accrual.service';

import { FacilityPriceService } from '../../../../core/services/facility-price.service';
import { FolioService } from '../../../../core/services/folio.service';
import { LegalEntityService } from '../../../../core/services/legal-entity.service';
import { PaymentService } from '../../../../core/services/payment.service';
import { ProfileService } from '../../../../core/services/profile.service';
import { ReservationService } from '../../../../core/services/reservation.service';
import {FacilityService} from '../../../../core/services/ facility.service';
import { FolioDetails } from '../../../../shared/folio-details/folio-details';
import { catchError, concatMap, forkJoin, from, of, tap, toArray } from 'rxjs';

@Component({
  selector: 'app-accrual-tab',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DatePipe, FolioDetails],
  templateUrl: './accrual-tab.html',
  styleUrl: './accrual-tab.scss'
})
export class AccrualTab implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly reservationService = inject(ReservationService);
  private readonly facilityService = inject(FacilityService);
  private readonly facilityPriceService = inject(FacilityPriceService);
  private readonly folioService = inject(FolioService);
  private readonly legalEntityService = inject(LegalEntityService);
  private readonly accrualService = inject(AccrualService);
  private readonly paymentService = inject(PaymentService);
  private readonly profileService = inject(ProfileService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly priceLoading = signal(false);

  readonly error = signal('');
  readonly success = signal('');
  readonly priceError = signal('');

  readonly reservationId = signal<number | null>(null);
  readonly hotelId = signal<number | null>(null);
  readonly primaryGuestId = signal<number | null>(null);
  readonly primaryGuest = signal<ProfileResponse | null>(null);
  readonly profiles = signal<ProfileResponse[]>([]);
  readonly reservations = signal<ReservationResponse[]>([]);

  readonly facilities = signal<FacilityResponse[]>([]);
  readonly selectedFacilityId = signal<number | null>(null);
  readonly facilitySearch = signal('');
  readonly selectedServiceDate = signal(this.getLocalDate());
  readonly selectedServiceEndDate = signal(this.getLocalDate());
  readonly servicePeriodPickerOpen = signal(false);
  readonly serviceCalendarMonth = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly serviceCalendarDays = computed(() => {
    const month = this.serviceCalendarMonth();
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return {
        date: day,
        iso: this.formatIsoDate(day),
        currentMonth: day.getMonth() === month.getMonth()
      };
    });
  });
  readonly servicePeriodLabel = computed(() => {
    const start = this.selectedServiceDate();
    const end = this.selectedServiceEndDate();
    if (!start) return 'Оберіть період послуги';
    return end ? `${this.formatServiceDate(start)} — ${this.formatServiceDate(end)}` : `${this.formatServiceDate(start)} — оберіть дату завершення`;
  });
  readonly selectedServiceDates = computed(() =>
    this.getDateRange(this.selectedServiceDate(), this.selectedServiceEndDate())
  );
  readonly accrualDestinationId = signal<number | null>(null);
  private serviceDateSelection: 'start' | 'end' = 'start';

  readonly facilityPrice = signal<number | null>(null);
  readonly facilityPrices = signal<number[]>([]);

  readonly folios = signal<FolioResponse[]>([]);
  readonly legalEntities = signal<LegalEntityResponse[]>([]);
  readonly unassignedAccruals = signal<AccrualResponse[]>([]);
  readonly unassignedError = signal('');
  readonly selectedFolioId = signal<number | null>(null);
  readonly selectedAccrualIds = signal<number[]>([]);
  readonly folioFormOpen = signal(false);
  readonly folioDetailsOpen = signal(false);

  readonly openFolios = computed(() =>
    this.folios().filter(folio => folio.status === FolioStatus.OPEN)
  );

  readonly closedFolios = computed(() =>
    this.folios().filter(folio => folio.status === FolioStatus.CLOSED)
  );

  readonly selectedFolio = computed(() =>
    this.openFolios().find(
      folio => folio.id === this.selectedFolioId()
    ) ?? null
  );

  readonly detailFolio = computed(() =>
    this.folios().find(folio => folio.id === this.selectedFolioId()) ?? null
  );

  readonly selectedFacility = computed(() =>
    this.facilities().find(
      facility => facility.id === this.selectedFacilityId()
    ) ?? null
  );

  readonly selectedAccruals = computed(() => {
    const selectedIds = new Set(this.selectedAccrualIds());
    return this.unassignedAccruals().filter(accrual => accrual.active && selectedIds.has(accrual.id));
  });

  folioAccruals(folio: FolioResponse): AccrualResponse[] {
    return (folio.accruals ?? []).filter(accrual => accrual.active);
  }

  readonly selectedAccrualTotal = computed(() =>
    this.selectedAccruals().reduce((total, accrual) => total + Number(accrual.amount), 0)
  );

  readonly estimatedTotal = computed(() => {
    const quantity = this.quantity;
    const prices = this.facilityPrices();
    if (!prices.length || !Number.isFinite(quantity) || quantity <= 0) {
      return 0;
    }
    return prices.reduce((total, price) => total + price, 0) * quantity;
  });

  readonly accruals = computed(() =>
    [
      ...this.folios().flatMap(folio => folio.accruals ?? []),
      ...this.unassignedAccruals()
    ]
      .filter(accrual => accrual.active)
      .filter(accrual => !accrual.folioId)
      .sort(
        (a, b) =>
          new Date(b.accruedAt).getTime() -
          new Date(a.accruedAt).getTime()
      )
  );

  readonly cancelledAccruals = computed(() =>
    [
      ...this.folios().flatMap(folio => folio.accruals ?? []),
      ...this.unassignedAccruals()
    ]
      .filter(accrual => !accrual.active && Number(accrual.amount) >= 0)
      .sort((a, b) => new Date(b.accruedAt).getTime() - new Date(a.accruedAt).getTime())
  );

  readonly selectableAccrualIds = computed(() =>
    this.accruals().filter(accrual => !accrual.folioId).map(accrual => accrual.id)
  );

  readonly allAccrualsSelected = computed(() =>
    this.selectableAccrualIds().length > 0 &&
    this.selectableAccrualIds().every(id => this.selectedAccrualIds().includes(id))
  );

  readonly totalAmount = computed(() =>
    this.folios().reduce(
      (total, folio) => total + Number(folio.totalAmount ?? 0), 0
    ) + this.unassignedAccruals().filter(accrual => accrual.active).reduce(
      (total, accrual) => total + Number(accrual.amount ?? 0), 0
    )
  );

  readonly paidAmount = computed(() =>
    this.folios().reduce(
      (total, folio) => total + Number(folio.paidAmount ?? 0),
      0
    )
  );

  readonly balance = computed(() =>
    this.folios().reduce(
      (total, folio) => total + Number(folio.balance ?? 0),
      0
    )
  );

  quantity = 1;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));

      if (!Number.isInteger(id) || id <= 0) {
        this.error.set('Не вдалося визначити номер бронювання.');
        this.loading.set(false);
        return;
      }

      this.reservationId.set(id);
      this.loadReservation(id);
    });
  }

  private loadReservation(reservationId: number): void {
    this.loading.set(true);
    this.error.set('');

    this.reservationService.getById(reservationId).subscribe({
      next: reservation => {
        const hotelId = reservation.room?.hotelId;
        this.primaryGuestId.set(reservation.primaryGuest?.id ?? null);
        this.primaryGuest.set(reservation.primaryGuest ?? null);
        this.reservations.set([reservation]);
        this.profileService.getAll().subscribe({
          next: profiles => this.profiles.set(profiles ?? []),
          error: () => this.profiles.set(reservation.primaryGuest ? [reservation.primaryGuest] : [])
        });

        if (hotelId === null || hotelId === undefined) {
          this.error.set(
            'Не вдалося визначити готель для цього бронювання.'
          );
          this.loading.set(false);
          return;
        }

        this.hotelId.set(hotelId);
        this.reservationService.getAll().subscribe({
          next: reservations => {
            const sameHotel = (reservations ?? []).filter(item => item.room?.hotelId === hotelId);
            if (!sameHotel.some(item => item.id === reservation.id)) sameHotel.push(reservation);
            this.reservations.set(sameHotel);
          },
          error: () => this.reservations.set([reservation])
        });
        this.legalEntityService.getByHotelId(hotelId).subscribe({
          next: entities => this.legalEntities.set(entities ?? []),
          error: () => this.legalEntities.set([])
        });
        this.loadFacilities(hotelId, reservationId);
      },
      error: () => {
        this.error.set('Не вдалося завантажити дані бронювання.');
        this.loading.set(false);
      }
    });
  }

  private loadFacilities(
    hotelId: number,
    reservationId: number
  ): void {
    this.facilityService.getActiveByHotelId(hotelId).subscribe({
      next: facilities => {
        const standardFacilities = (facilities ?? []).filter(
          facility => facility.type === FacilityType.STANDARD
        );

        this.facilities.set(standardFacilities);

        if (standardFacilities.length > 0) {
          this.selectedFacilityId.set(standardFacilities[0].id);
          this.facilitySearch.set(this.facilityOptionLabel(standardFacilities[0]));
          this.loadFacilityPrice();
        } else {
          this.selectedFacilityId.set(null);
          this.facilitySearch.set('');
          this.facilityPrice.set(null);
          this.priceError.set(
            'Для цього готелю немає активних звичайних послуг.'
          );
        }

        this.loadFolios(reservationId);
      },
      error: () => {
        this.facilities.set([]);
        this.selectedFacilityId.set(null);
        this.facilityPrice.set(null);
        this.priceError.set('Не вдалося завантажити список послуг.');
        this.loadFolios(reservationId);
      }
    });
  }

  private loadFolios(reservationId: number): void {
    this.unassignedError.set('');
    forkJoin({
      folios: this.folioService.getByReservationId(reservationId),
      unassigned: this.accrualService
        .getUnassignedByReservationId(reservationId)
        .pipe(catchError(() => {
          this.unassignedError.set('Не вдалося завантажити нарахування, ще не прив’язані до рахунку.');
          return of([] as AccrualResponse[]);
        }))
    }).subscribe({
      next: data => {
        this.setFolioData(data.folios ?? []);
        this.unassignedAccruals.set(data.unassigned ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.folios.set([]);
        this.selectedFolioId.set(null);
        this.error.set(
          'Не вдалося завантажити рахунки цього бронювання.'
        );
        this.loading.set(false);
      }
    });
  }

  selectFacility(facilityId: number | null): void {
    this.selectedFacilityId.set(
      facilityId === null ? null : Number(facilityId)
    );

    this.loadFacilityPrice();
  }

  facilityOptionLabel(facility: FacilityResponse): string {
    return `${facility.name} (${facility.unit})`;
  }

  adjustQuantity(amount: number): void {
    this.quantity = Math.max(1, Math.floor(Number(this.quantity) || 1) + amount);
  }

  selectFacilityBySearch(value: string): void {
    this.facilitySearch.set(value);
    const query = value.trim().toLocaleLowerCase();
    const facility = this.facilities().find(item =>
      this.facilityOptionLabel(item).toLocaleLowerCase() === query
    );
    this.selectedFacilityId.set(facility?.id ?? null);
    this.loadFacilityPrice();
  }

  toggleServicePeriodPicker(): void {
    if (!this.servicePeriodPickerOpen()) {
      const [year, month] = this.selectedServiceDate().split('-').map(Number);
      this.serviceCalendarMonth.set(new Date(year, month - 1, 1));
      this.serviceDateSelection = 'start';
    }
    this.servicePeriodPickerOpen.update(open => !open);
  }

  shiftServiceCalendar(offset: number): void {
    const month = this.serviceCalendarMonth();
    this.serviceCalendarMonth.set(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }

  selectServicePeriodDate(iso: string): void {
    if (this.serviceDateSelection === 'start') {
      this.selectedServiceDate.set(iso);
      this.selectedServiceEndDate.set('');
      this.serviceDateSelection = 'end';
      this.loadFacilityPrice();
      return;
    }
    if (iso < this.selectedServiceDate()) {
      this.selectedServiceDate.set(iso);
      this.selectedServiceEndDate.set('');
      this.loadFacilityPrice();
      return;
    }
    this.selectedServiceEndDate.set(iso);
    this.serviceDateSelection = 'start';
    this.servicePeriodPickerOpen.set(false);
    this.loadFacilityPrice();
  }

  isServicePeriodDateSelected(iso: string): boolean {
    return iso === this.selectedServiceDate() || iso === this.selectedServiceEndDate();
  }

  isServicePeriodDateInRange(iso: string): boolean {
    const start = this.selectedServiceDate();
    const end = this.selectedServiceEndDate();
    return Boolean(start && end && iso > start && iso < end);
  }

  selectAccrualDestination(value: number | string | null): void {
    this.accrualDestinationId.set(value === null || value === '' ? null : Number(value));
  }

  private loadFacilityPrice(): void {
    const facilityId = this.selectedFacilityId();
    const startDate = this.selectedServiceDate();
    const endDate = this.selectedServiceEndDate();
    const serviceDates = this.selectedServiceDates();

    this.facilityPrice.set(null);
    this.facilityPrices.set([]);
    this.priceError.set('');

    if (!facilityId || serviceDates.length === 0) {
      this.priceLoading.set(false);
      return;
    }

    this.priceLoading.set(true);

    forkJoin(serviceDates.map(date => this.facilityPriceService.getPriceForDate(facilityId, date)))
      .subscribe({
        next: responses => {
          if (
            this.selectedFacilityId() !== facilityId ||
            this.selectedServiceDate() !== startDate ||
            this.selectedServiceEndDate() !== endDate
          ) {
            return;
          }

          const prices = responses.map(response => Number(response.price));
          this.facilityPrices.set(prices);
          this.facilityPrice.set(prices[0] ?? null);
          this.priceLoading.set(false);
        },
        error: () => {
          if (
            this.selectedFacilityId() !== facilityId ||
            this.selectedServiceDate() !== startDate ||
            this.selectedServiceEndDate() !== endDate
          ) {
            return;
          }

          this.facilityPrice.set(null);
          this.priceLoading.set(false);
          this.priceError.set(
            'Для цієї послуги немає ціни на одну або кілька дат періоду.'
          );
        }
      });
  }

  openFolioDetails(folio: FolioResponse): void {
    this.selectedFolioId.set(folio.id);
    this.error.set('');
    this.success.set('');
    this.folioDetailsOpen.set(true);
  }

  closeFolioDetails(): void {
    if (!this.saving()) this.folioDetailsOpen.set(false);
  }

  saveFolioParties(folio: FolioResponse, request: FolioPartiesRequest): void {
    if (this.saving()) return;
    if (![request.recipientId, request.payerId, request.reservationId].every(id => Number.isInteger(id) && id > 0)) {
      this.error.set('Вкажи коректні ID одержувача та платника.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.folioService.updateParties(folio.id, request).subscribe({
      next: updatedFolio => {
        this.setFolioData(this.folios().map(item => item.id === updatedFolio.id ? updatedFolio : item));
        this.refreshFolios();
        this.success.set('Одержувача та платника рахунку збережено.');
        this.saving.set(false);
      },
      error: error => {
        this.saving.set(false);
        this.error.set(error?.error?.message || 'Не вдалося зберегти одержувача та платника.');
      }
    });
  }

  isAccrualSelected(id: number): boolean {
    return this.selectedAccrualIds().includes(id);
  }

  toggleAccrualSelection(id: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedAccrualIds.update(ids => checked
      ? Array.from(new Set([...ids, id]))
      : ids.filter(selectedId => selectedId !== id));
  }

  toggleAllAccrualSelection(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const ids = this.selectableAccrualIds();
    this.selectedAccrualIds.update(selected => checked
      ? Array.from(new Set([...selected.filter(id => ids.includes(id)), ...ids]))
      : selected.filter(id => !ids.includes(id)));
  }

  cancelAccrual(accrual: AccrualResponse): void {
    if (this.saving() || !window.confirm(`Анулювати нарахування «${accrual.name}»?`)) return;
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    this.accrualService.cancel(accrual.id).subscribe({
      next: () => {
        this.selectedAccrualIds.update(ids => ids.filter(id => id !== accrual.id));
        this.success.set('Нарахування анульовано.');
        this.refreshFolios();
      },
      error: error => {
        this.saving.set(false);
        this.error.set(error?.error?.message || 'Не вдалося анулювати нарахування.');
      }
    });
  }

  reactivateAccrual(accrual: AccrualResponse): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    this.accrualService.reactivate(accrual.id).subscribe({
      next: () => {
        this.success.set('Нарахування знову активне.');
        this.refreshFolios();
      },
      error: error => {
        this.saving.set(false);
        this.error.set(error?.error?.message || 'Не вдалося активувати нарахування.');
      }
    });
  }

  openFolioForm(): void {
    if (this.selectedAccrualIds().length === 0) return;
    this.folioFormOpen.set(true);
  }

  closeFolioForm(): void {
    if (!this.saving()) this.folioFormOpen.set(false);
  }

  createFolioWithSelectedAccruals(parties: FolioPartiesRequest): void {
    const hotelId = this.hotelId();
    const reservationId = this.reservationId();
    const accrualIds = this.selectedAccruals().map(accrual => accrual.id);
    if (!hotelId || !reservationId || accrualIds.length === 0 || this.saving()) return;

    if ([parties.recipientId, parties.payerId, parties.reservationId].some(id =>
      id === null || !Number.isInteger(id) || id <= 0
    )) {
      this.error.set('Вкажи коректні ID одержувача та платника.');
      return;
    }

    const request: FolioRequest = {
      hotelId,
      reservationId: parties.reservationId,
      recipientId: parties.recipientId,
      payerId: parties.payerId,
      serviceProviderId: parties.serviceProviderId
    };

    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    this.folioService.create(request).subscribe({
      next: folio => this.folioService.attachAccruals(folio.id, accrualIds).subscribe({
        next: () => this.folioService.getById(folio.id).subscribe({
          next: createdFolio => {
            this.folioFormOpen.set(false);
            this.selectedAccrualIds.set([]);
            this.setFolioData([...this.folios(), createdFolio]);
            this.success.set(`Створено рахунок №${createdFolio.id} та додано вибрані нарахування.`);
            this.refreshFolios();
          },
          error: () => {
            this.folioFormOpen.set(false);
            this.selectedAccrualIds.set([]);
            this.success.set(`Рахунок №${folio.id} створено й нарахування прив’язано.`);
            this.refreshFolios();
          }
        }),
        error: () => {
          this.saving.set(false);
          this.error.set(`Рахунок №${folio.id} створено, але вибрані нарахування не вдалося прив’язати. Їх можна вибрати й прив’язати пізніше.`);
          this.refreshFolios();
        }
      }),
      error: () => {
        this.saving.set(false);
        this.error.set('Не вдалося створити рахунок. Перевір дані й повтори спробу.');
      }
    });
  }

  attachSelectedAccrualsToFolio(): void {
    const folio = this.selectedFolio();
    const accrualIds = this.selectedAccruals().map(accrual => accrual.id);
    if (!folio || accrualIds.length === 0 || this.saving()) return;

    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    this.folioService.attachAccruals(folio.id, accrualIds).subscribe({
      next: () => {
        this.selectedAccrualIds.set([]);
        this.success.set(`Вибрані нарахування додано до рахунку №${folio.id}.`);
        this.refreshFolios();
      },
      error: error => {
        this.saving.set(false);
        this.error.set(error?.error?.message || 'Не вдалося додати вибрані нарахування до рахунку.');
      }
    });
  }

  closeFolio(folio: FolioResponse): void {
    if (this.saving() || !window.confirm(`Закрити рахунок №${folio.id}?`)) return;
    this.saving.set(true);
    this.error.set('');
    this.folioService.close(folio.id).subscribe({
      next: () => {
        this.folioDetailsOpen.set(false);
        this.success.set(`Рахунок №${folio.id} закрито.`);
        this.refreshFolios();
      },
      error: error => {
        this.saving.set(false);
        this.error.set(error?.error?.message || 'Не вдалося закрити рахунок. Спочатку перевір його баланс.');
      }
    });
  }

  reopenFolio(folio: FolioResponse): void {
    if (this.saving()) return;
    const reason = window.prompt(`Вкажи причину повторного відкриття рахунку №${folio.id}:`);
    if (!reason?.trim()) return;
    const request: FolioReopenRequest = { reason: reason.trim() };
    this.saving.set(true);
    this.error.set('');
    this.folioService.reopen(folio.id, request).subscribe({
      next: () => {
        this.success.set(`Рахунок №${folio.id} повторно відкрито.`);
        this.refreshFolios();
      },
      error: error => {
        this.saving.set(false);
        this.error.set(error?.error?.message || 'Не вдалося повторно відкрити рахунок.');
      }
    });
  }

  deleteFolio(folio: FolioResponse): void {
    if (this.saving() || folio.accruals.length > 0 || folio.payments.length > 0) return;
    if (!window.confirm(`Видалити порожній рахунок №${folio.id}?`)) return;
    this.saving.set(true);
    this.error.set('');
    this.folioService.delete(folio.id).subscribe({
      next: () => {
        this.folioDetailsOpen.set(false);
        this.success.set(`Рахунок №${folio.id} видалено.`);
        this.refreshFolios();
      },
      error: error => {
        this.saving.set(false);
        this.error.set(error?.error?.message || 'Не вдалося видалити рахунок.');
      }
    });
  }

  addAccrual(): void {
    const reservationId = this.reservationId();
    const facilityId = this.selectedFacilityId();
    const serviceDates = this.selectedServiceDates();
    const destinationFolioId = this.accrualDestinationId();

    if (!reservationId || !facilityId || this.saving()) {
      return;
    }

    if (serviceDates.length === 0) {
      this.error.set('Вкажи коректний період надання послуги.');
      return;
    }

    if (this.facilityPrices().length !== serviceDates.length || this.facilityPrices().some(price => !Number.isFinite(price) || price <= 0)) {
      this.error.set('Неможливо додати послугу: перевір чинні ціни для всього періоду.');
      return;
    }

    if (!Number.isInteger(this.quantity) || this.quantity < 1) {
      this.error.set('Кількість має бути цілим числом від 1.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    let createdCount = 0;
    from(serviceDates).pipe(
      concatMap(serviceDate => this.accrualService.create({
        facilityId,
        reservationId,
        serviceDate,
        quantity: this.quantity,
        ...(destinationFolioId === null ? {} : { folioId: destinationFolioId })
      } satisfies AccrualRequest).pipe(tap(() => createdCount++))),
      toArray()
    ).subscribe({
      next: () => {
        this.quantity = 1;
        this.success.set(destinationFolioId === null
          ? `Додано ${createdCount} нарахувань до списку «Нарахування».`
          : `Додано ${createdCount} нарахувань до рахунку №${destinationFolioId}.`);
        this.refreshFolios();
      },
      error: () => {
        this.error.set(createdCount > 0
          ? `Додано ${createdCount} із ${serviceDates.length} нарахувань; решту не вдалося створити.`
          : 'Не вдалося додати нарахування. Перевір послугу, період та ціни.');
        this.refreshFolios();
      }
    });
  }

  addPayment(folio: FolioResponse, request: PaymentRequest): void {
    if (this.saving()) return;
    if (!Number.isFinite(request.amount) || request.amount <= 0) {
      this.error.set('Вкажи суму платежу, більшу за нуль.');
      this.success.set('');
      return;
    }

    if (request.amount > Number(folio.balance)) {
      this.error.set(
        'Сума платежу не може перевищувати поточний баланс рахунку.'
      );
      this.success.set('');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    this.paymentService.create(request).subscribe({
      next: () => {
        this.success.set('Платіж успішно додано.');
        this.refreshFolios();
      },
      error: () => {
        this.saving.set(false);
        this.error.set(
          'Не вдалося додати платіж. Перевір стан рахунку та суму.'
        );
      }
    });
  }

  trackAccrual(_: number, accrual: AccrualResponse): number {
    return accrual.id;
  }

  trackFacility(_: number, facility: FacilityResponse): number {
    return facility.id;
  }

  trackFolio(_: number, folio: FolioResponse): number {
    return folio.id;
  }

  private setFolioData(folios: FolioResponse[]): void {
    this.folios.set(folios);
    const destinationId = this.accrualDestinationId();
    if (destinationId !== null && !folios.some(folio => folio.id === destinationId && folio.status === FolioStatus.OPEN)) {
      this.accrualDestinationId.set(null);
    }

    const currentSelectedId = this.selectedFolioId();
    const currentStillOpen = folios.some(
      folio =>
        folio.id === currentSelectedId &&
        folio.status === FolioStatus.OPEN
    );

    if (!currentStillOpen) {
      this.selectedFolioId.set(
        folios.find(folio => folio.status === FolioStatus.OPEN)?.id ?? null
      );
    }
  }

  private refreshFolios(): void {
    const reservationId = this.reservationId();

    if (!reservationId) {
      this.saving.set(false);
      return;
    }

    forkJoin({
      folios: this.folioService.getByReservationId(reservationId),
      unassigned: this.accrualService
        .getUnassignedByReservationId(reservationId)
        .pipe(catchError(() => {
          this.unassignedError.set('Не вдалося оновити нарахування, ще не прив’язані до рахунку.');
          return of([] as AccrualResponse[]);
        }))
    }).subscribe({
      next: data => {
        this.setFolioData(data.folios ?? []);
        this.unassignedAccruals.set(data.unassigned ?? []);
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.error.set(
          'Операцію виконано, але не вдалося оновити дані рахунків.'
        );
      }
    });
  }

  private getLocalDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private formatIsoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private formatServiceDate(iso: string): string {
    const [year, month, day] = iso.split('-');
    return `${day}.${month}.${year}`;
  }

  private getDateRange(start: string, end: string): string[] {
    if (!start || !end || end < start) return [];
    const dates: string[] = [];
    const [year, month, day] = start.split('-').map(Number);
    const cursor = new Date(year, month - 1, day);
    const [endYear, endMonth, endDay] = end.split('-').map(Number);
    const final = new Date(endYear, endMonth - 1, endDay);
    while (cursor <= final) {
      dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }
}
