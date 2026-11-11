import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { AccrualRequest } from '../../../../core/models/billing/accrual-request.model';
import { AccrualResponse } from '../../../../core/models/billing/accrual-response.model';
import { FolioResponse } from '../../../../core/models/billing/folio-response.model';
import { PaymentRequest } from '../../../../core/models/billing/payment-request.model';
import { PaymentResponse } from '../../../../core/models/billing/payment-response.model';
import { AccrualType } from '../../../../core/models/enums/accrual-type.enum';
import { FolioStatus } from '../../../../core/models/enums/folio-status.enum';
import { PaymentMethod } from '../../../../core/models/enums/payment-method.enum';

import { FolioService } from '../../../../core/services/folio.service';
import { AccrualService } from '../../../../core/services/accrual.service';
import { PaymentService } from '../../../../core/services/payment.service';
import { ReservationService } from '../../../../core/services/reservation.service';

@Component({
  selector: 'app-accrual-tab',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './accrual-tab.html',
  styleUrl: './accrual-tab.scss'
})
export class AccrualTab implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly folioService = inject(FolioService);
  private readonly accrualService = inject(AccrualService);
  private readonly paymentService = inject(PaymentService);
  private readonly reservationService = inject(ReservationService);

  readonly today = new Date();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  readonly reservationId = signal<number | null>(null);
  readonly hotelId = signal<number | null>(null);

  readonly folios = signal<FolioResponse[]>([]);
  readonly selectedFolioId = signal<number | null>(null);

  readonly openFolios = computed(() =>
    this.folios().filter(folio => folio.status === FolioStatus.OPEN)
  );

  readonly closedFolios = computed(() =>
    this.folios().filter(folio => folio.status === FolioStatus.CLOSED)
  );

  readonly selectedFolio = computed(() =>
    this.openFolios().find(folio => folio.id === this.selectedFolioId()) ?? null
  );

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

  readonly advanceAmount = computed(() =>
    this.folios().reduce(
      (total, folio) => total + Number(folio.advanceAmount ?? 0),
      0
    )
  );

  readonly accrualTypes = Object.values(AccrualType);
  readonly paymentMethods = Object.values(PaymentMethod);

  readonly accrualLabels: Record<AccrualType, string> = {
    [AccrualType.ROOM]: 'Проживання',
    [AccrualType.BREAKFAST]: 'Сніданок',
    [AccrualType.SERVICE]: 'Послуга',
    [AccrualType.MINIBAR]: 'Мінібар',
    [AccrualType.LAUNDRY]: 'Прання',
    [AccrualType.PARKING]: 'Паркування',
    [AccrualType.OTHER]: 'Інше'
  };

  readonly paymentLabels: Record<PaymentMethod, string> = {
    [PaymentMethod.CASH]: 'Готівка',
    [PaymentMethod.CARD]: 'Картка',
    [PaymentMethod.BANK_TRANSFER]: 'Банківський переказ'
  };

  serviceType: AccrualType = AccrualType.SERVICE;
  serviceName = '';
  quantity = 1;
  unitPrice: number | null = null;
  notes = '';

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
      this.loadData(id);
    });
  }

  loadData(reservationId: number): void {
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
        this.loadFolios(reservationId);
      },
      error: () => {
        this.error.set('Не вдалося завантажити дані бронювання.');
        this.loading.set(false);
      }
    });
  }

  loadFolios(reservationId: number): void {
    this.folioService.getByReservationId(reservationId).subscribe({
      next: folios => {
        this.setFolioData(folios ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.folios.set([]);
        this.selectedFolioId.set(null);
        this.error.set(
          'Не вдалося завантажити рахунки. Перевір, чи створене фоліо для цього бронювання.'
        );
        this.loading.set(false);
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
    const hotelId = this.hotelId();

    if (!folio || !reservationId || !hotelId || this.saving()) {
      return;
    }

    const name = this.serviceName.trim();

    if (
      !name ||
      this.unitPrice === null ||
      !Number.isFinite(this.unitPrice) ||
      this.unitPrice < 0 ||
      !Number.isInteger(this.quantity) ||
      this.quantity < 1
    ) {
      this.error.set(
        'Вкажи назву послуги, коректну вартість і кількість.'
      );
      this.success.set('');
      return;
    }

    const request: AccrualRequest = {
      hotelId,
      reservationId,
      folioId: folio.id,
      type: this.serviceType,
      name,
      description: this.notes.trim() || null,
      unitPrice: this.unitPrice,
      quantity: this.quantity
    };

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    this.accrualService.create(request).subscribe({
      next: () => {
        this.serviceName = '';
        this.quantity = 1;
        this.unitPrice = null;
        this.notes = '';

        this.success.set('Нарахування успішно додано.');
        this.refreshFolios();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Не вдалося додати нарахування.');
      }
    });
  }

  deleteAccrual(accrual: AccrualResponse): void {
    const folio = this.folios().find(item => item.id === accrual.folioId);

    if (!folio || folio.status === FolioStatus.CLOSED || this.saving()) {
      return;
    }

    const name = accrual.name || accrual.description || 'нарахування';
    const confirmed = window.confirm(`Видалити нарахування «${name}»?`);

    if (!confirmed) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    this.accrualService.delete(accrual.id).subscribe({
      next: () => {
        this.success.set('Нарахування видалено.');
        this.refreshFolios();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Не вдалося видалити нарахування.');
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
          'Не вдалося додати платіж. Перевір стан рахунку та відповідь API.'
        );
      }
    });
  }

  formatAccrualType(type: AccrualType): string {
    return this.accrualLabels[type] ?? type;
  }

  formatPaymentMethod(method: PaymentMethod): string {
    return this.paymentLabels[method] ?? method;
  }

  trackAccrual(_: number, accrual: AccrualResponse): number {
    return accrual.id;
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
  canDeleteAccrual(accrual: AccrualResponse): boolean {
    return this.openFolios().some(folio => folio.id === accrual.folioId);
  }
}
