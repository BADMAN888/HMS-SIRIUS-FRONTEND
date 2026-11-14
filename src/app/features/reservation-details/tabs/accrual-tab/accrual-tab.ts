import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { AccrualRequest } from '../../../../core/models/billing/accrual-request.model';
import { AccrualResponse } from '../../../../core/models/billing/accrual-response.model';
import { FacilityResponse } from '../../../../core/models/billing/facility-response.model';
import { FolioResponse } from '../../../../core/models/billing/folio-response.model';
import { PaymentRequest } from '../../../../core/models/billing/payment-request.model';
import { PaymentResponse } from '../../../../core/models/billing/payment-response.model';
import { FacilityType } from '../../../../core/models/enums/facility-type.enum';
import { FolioStatus } from '../../../../core/models/enums/folio-status.enum';
import { PaymentMethod } from '../../../../core/models/enums/payment-method.enum';

import { AccrualService } from '../../../../core/services/accrual.service';

import { FacilityPriceService } from '../../../../core/services/facility-price.service';
import { FolioService } from '../../../../core/services/folio.service';
import { PaymentService } from '../../../../core/services/payment.service';
import { ReservationService } from '../../../../core/services/reservation.service';
import {FacilityService} from '../../../../core/services/ facility.service';

@Component({
  selector: 'app-accrual-tab',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './accrual-tab.html',
  styleUrl: './accrual-tab.scss'
})
export class AccrualTab implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly reservationService = inject(ReservationService);
  private readonly facilityService = inject(FacilityService);
  private readonly facilityPriceService = inject(FacilityPriceService);
  private readonly folioService = inject(FolioService);
  private readonly accrualService = inject(AccrualService);
  private readonly paymentService = inject(PaymentService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly priceLoading = signal(false);

  readonly error = signal('');
  readonly success = signal('');
  readonly priceError = signal('');

  readonly reservationId = signal<number | null>(null);
  readonly hotelId = signal<number | null>(null);

  readonly facilities = signal<FacilityResponse[]>([]);
  readonly selectedFacilityId = signal<number | null>(null);
  readonly selectedServiceDate = signal(this.getLocalDate());

  readonly facilityPrice = signal<number | null>(null);

  readonly folios = signal<FolioResponse[]>([]);
  readonly selectedFolioId = signal<number | null>(null);

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

  readonly selectedFacility = computed(() =>
    this.facilities().find(
      facility => facility.id === this.selectedFacilityId()
    ) ?? null
  );

  readonly estimatedTotal = computed(() => {
    const price = this.facilityPrice();
    const quantity = this.quantity;

    if (price === null || !Number.isFinite(quantity) || quantity <= 0) {
      return 0;
    }

    return price * quantity;
  });

  readonly accruals = computed(() =>
    this.folios()
      .flatMap(folio => folio.accruals ?? [])
      .sort(
        (a, b) =>
          new Date(b.accruedAt).getTime() -
          new Date(a.accruedAt).getTime()
      )
  );

  readonly payments = computed(() =>
    this.folios()
      .flatMap(folio => folio.payments ?? [])
      .sort(
        (a, b) =>
          new Date(b.paidAt).getTime() -
          new Date(a.paidAt).getTime()
      )
  );

  readonly totalAmount = computed(() =>
    this.folios().reduce(
      (total, folio) => total + Number(folio.totalAmount ?? 0),
      0
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

  readonly paymentMethods = Object.values(PaymentMethod);

  readonly paymentLabels: Record<PaymentMethod, string> = {
    [PaymentMethod.CASH]: 'Готівка',
    [PaymentMethod.CARD]: 'Картка',
    [PaymentMethod.BANK_TRANSFER]: 'Банківський переказ',
    [PaymentMethod.BALANCE]: 'З балансу'
  };

  quantity = 1;

  paymentMethod: PaymentMethod = PaymentMethod.CASH;
  paymentAmount: number | null = null;
  paymentDescription = '';

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

        if (hotelId === null || hotelId === undefined) {
          this.error.set(
            'Не вдалося визначити готель для цього бронювання.'
          );
          this.loading.set(false);
          return;
        }

        this.hotelId.set(hotelId);
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
          this.loadFacilityPrice();
        } else {
          this.selectedFacilityId.set(null);
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
    this.folioService.getByReservationId(reservationId).subscribe({
      next: folios => {
        this.setFolioData(folios ?? []);
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

  selectServiceDate(date: string): void {
    this.selectedServiceDate.set(date);
    this.loadFacilityPrice();
  }

  private loadFacilityPrice(): void {
    const facilityId = this.selectedFacilityId();
    const serviceDate = this.selectedServiceDate();

    this.facilityPrice.set(null);
    this.priceError.set('');

    if (!facilityId || !serviceDate) {
      return;
    }

    this.priceLoading.set(true);

    this.facilityPriceService
      .getPriceForDate(facilityId, serviceDate)
      .subscribe({
        next: response => {
          if (
            this.selectedFacilityId() !== facilityId ||
            this.selectedServiceDate() !== serviceDate
          ) {
            return;
          }

          this.facilityPrice.set(Number(response.price));
          this.priceLoading.set(false);
        },
        error: () => {
          if (
            this.selectedFacilityId() !== facilityId ||
            this.selectedServiceDate() !== serviceDate
          ) {
            return;
          }

          this.facilityPrice.set(null);
          this.priceLoading.set(false);
          this.priceError.set(
            'Для цієї послуги немає ціни на вибрану дату.'
          );
        }
      });
  }

  selectFolio(folioId: number): void {
    this.selectedFolioId.set(Number(folioId));
    this.error.set('');
    this.success.set('');
  }

  addAccrual(): void {
    const folio = this.selectedFolio();
    const reservationId = this.reservationId();
    const facilityId = this.selectedFacilityId();
    const serviceDate = this.selectedServiceDate();
    const price = this.facilityPrice();

    if (!folio || !reservationId || !facilityId || this.saving()) {
      return;
    }

    if (!serviceDate) {
      this.error.set('Вкажи дату надання послуги.');
      return;
    }

    if (price === null || !Number.isFinite(price) || price <= 0) {
      this.error.set('Неможливо додати послугу без чинної ціни.');
      return;
    }

    if (!Number.isFinite(this.quantity) || this.quantity <= 0) {
      this.error.set('Кількість повинна бути більшою за нуль.');
      return;
    }

    const request: AccrualRequest = {
      facilityId,
      reservationId,
      folioId: folio.id,
      serviceDate,
      quantity: this.quantity
    };

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    this.accrualService.create(request).subscribe({
      next: () => {
        this.quantity = 1;
        this.success.set('Нарахування успішно додано.');
        this.refreshFolios();
      },
      error: () => {
        this.saving.set(false);
        this.error.set(
          'Не вдалося додати нарахування. Перевір послугу, дату та стан рахунку.'
        );
      }
    });
  }

  addPayment(): void {
    const folio = this.selectedFolio();

    if (!folio || this.saving()) {
      return;
    }

    if (
      this.paymentAmount === null ||
      !Number.isFinite(this.paymentAmount) ||
      this.paymentAmount <= 0
    ) {
      this.error.set('Вкажи суму платежу, більшу за нуль.');
      this.success.set('');
      return;
    }

    if (this.paymentAmount > Number(folio.balance)) {
      this.error.set(
        'Сума платежу не може перевищувати поточний баланс рахунку.'
      );
      this.success.set('');
      return;
    }

    const request: PaymentRequest = {
      folioId: folio.id,
      method: this.paymentMethod,
      amount: this.paymentAmount,
      description: this.paymentDescription.trim() || null
    };

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    this.paymentService.create(request).subscribe({
      next: () => {
        this.paymentAmount = null;
        this.paymentDescription = '';

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

  formatPaymentMethod(method: PaymentMethod): string {
    return this.paymentLabels[method] ?? method;
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

  trackPayment(_: number, payment: PaymentResponse): number {
    return payment.id;
  }

  private setFolioData(folios: FolioResponse[]): void {
    this.folios.set(folios);

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

    this.folioService.getByReservationId(reservationId).subscribe({
      next: folios => {
        this.setFolioData(folios ?? []);
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
}
