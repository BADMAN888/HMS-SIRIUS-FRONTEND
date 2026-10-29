
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { AccrualRequest } from '../../../../core/models/billing/accrual-request.model';
import { AccrualResponse } from '../../../../core/models/billing/accrual-response.model';
import { FolioResponse } from '../../../../core/models/billing/folio-response.model';
import { PaymentRequest } from '../../../../core/models/billing/payment-request.model';
import { AccrualType } from '../../../../core/models/enums/accrual-type.enum';
import { FolioStatus } from '../../../../core/models/enums/folio-status.enum';
import { PaymentMethod } from '../../../../core/models/enums/payment-method.enum';

import { FolioService } from '../../../../core/services/folio.service';
import { AccrualService } from '../../../../core/services/accrual.service';
import { PaymentService } from '../../../../core/services/payment.service';

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

  readonly today = new Date();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  readonly folio = signal<FolioResponse | null>(null);
  readonly accruals = signal<AccrualResponse[]>([]);

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

  readonly accrualTypeLabels = this.accrualLabels;
  readonly paymentMethodLabels = this.paymentLabels;

  readonly isClosed = computed(
    () => this.folio()?.status === FolioStatus.CLOSED
  );

  readonly totalAmount = computed(
    () => Number(this.folio()?.totalAmount ?? 0)
  );

  readonly paidAmount = computed(
    () => Number(this.folio()?.paidAmount ?? 0)
  );

  readonly balance = computed(
    () => Math.max(this.totalAmount() - this.paidAmount(), 0)
  );

  readonly advanceAmount = computed(
    () => Math.max(this.paidAmount() - this.totalAmount(), 0)
  );

  readonly openFolio = computed(
    () => this.folio()?.status === FolioStatus.OPEN
      ? this.folio()
      : null
  );

  readonly closedFolio = computed(
    () => this.folio()?.status === FolioStatus.CLOSED
      ? this.folio()
      : null
  );

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
      const reservationId = Number(params.get('id'));

      if (!Number.isInteger(reservationId) || reservationId <= 0) {
        this.error.set('Не вдалося визначити номер бронювання.');
        this.loading.set(false);
        return;
      }

      this.loadFolio(reservationId);
    });
  }

  loadFolio(reservationId: number): void {
    this.loading.set(true);
    this.error.set('');

    this.folioService.getByReservationId(reservationId).subscribe({
      next: folio => {
        this.setFolioData(folio);
        this.loading.set(false);
      },
      error: () => {
        this.folio.set(null);
        this.accruals.set([]);
        this.error.set(
          'Не вдалося завантажити рахунок. Перевір, чи створене фоліо для цього бронювання.'
        );
        this.loading.set(false);
      }
    });
  }

  addAccrual(): void {
    const folio = this.folio();

    if (!folio || this.isClosed() || this.saving()) {
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
      folioId: folio.id,
      type: this.serviceType,
      description: this.notes.trim()
        ? `${name} — ${this.notes.trim()}`
        : name,
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
        this.refreshFolio(folio.reservationId);
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Не вдалося додати нарахування.');
      }
    });
  }

  deleteAccrual(accrual: AccrualResponse): void {
    if (this.isClosed() || this.saving()) {
      return;
    }

    const confirmed = window.confirm(
      `Видалити нарахування «${accrual.description}»?`
    );

    if (!confirmed) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    this.accrualService.delete(accrual.id).subscribe({
      next: () => {
        const folio = this.folio();

        if (folio) {
          this.success.set('Нарахування видалено.');
          this.refreshFolio(folio.reservationId);
        } else {
          this.saving.set(false);
        }
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Не вдалося видалити нарахування.');
      }
    });
  }

  addPayment(): void {
    const folio = this.folio();

    if (!folio || this.isClosed() || this.saving()) {
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
        this.refreshFolio(folio.reservationId);
      },
      error: () => {
        this.saving.set(false);
        this.error.set(
          'Не вдалося додати платіж. Перевір обмеження API та стан рахунку.'
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

  private setFolioData(folio: FolioResponse): void {
    this.folio.set(folio);

    this.accruals.set(
      [...(folio.accruals ?? [])].sort(
        (a, b) =>
          new Date(b.accruedAt).getTime() -
          new Date(a.accruedAt).getTime()
      )
    );
  }

  private refreshFolio(reservationId: number): void {
    this.folioService.getByReservationId(reservationId).subscribe({
      next: folio => {
        this.setFolioData(folio);
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.error.set(
          'Операцію виконано, але не вдалося оновити дані рахунку.'
        );
      }
    });
  }
}
