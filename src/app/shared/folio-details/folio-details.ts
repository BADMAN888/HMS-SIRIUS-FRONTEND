import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AccrualResponse } from '../../core/models/billing/accrual-response.model';
import { FolioPartiesRequest } from '../../core/models/billing/folio-parties-request.model';
import { FolioResponse } from '../../core/models/billing/folio-response.model';
import { PaymentRequest } from '../../core/models/billing/payment-request.model';
import { FolioStatus } from '../../core/models/enums/folio-status.enum';
import { PaymentMethod } from '../../core/models/enums/payment-method.enum';

@Component({
  selector: 'app-folio-details',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './folio-details.html',
  styleUrl: './folio-details.scss'
})
export class FolioDetails implements OnChanges {
  @Input({ required: true }) folio!: FolioResponse;
  @Input() primaryGuestId: number | null = null;
  @Input() saving = false;
  @Input() error = '';
  @Input() success = '';

  @Output() close = new EventEmitter<void>();
  @Output() partiesSave = new EventEmitter<FolioPartiesRequest>();
  @Output() paymentSubmit = new EventEmitter<PaymentRequest>();
  @Output() accrualCancel = new EventEmitter<AccrualResponse>();
  @Output() folioClose = new EventEmitter<void>();
  @Output() folioReopen = new EventEmitter<void>();
  @Output() folioDelete = new EventEmitter<void>();

  recipientId: number | null = null;
  payerId: number | null = null;
  paymentMethods = Object.values(PaymentMethod);
  paymentMethod: PaymentMethod = PaymentMethod.CASH;
  paymentAmount: number | null = null;
  paymentDescription = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['folio'] || changes['primaryGuestId']) {
      this.recipientId = this.folio?.recipientId ?? this.primaryGuestId;
      this.payerId = this.folio?.payerId ?? this.primaryGuestId;
    }
  }

  get activeAccruals(): AccrualResponse[] {
    return (this.folio?.accruals ?? []).filter(accrual => accrual.active);
  }

  saveParties(): void {
    if (this.saving || !this.isValidPartyId(this.recipientId) || !this.isValidPartyId(this.payerId)) return;
    this.partiesSave.emit({ recipientId: this.recipientId, payerId: this.payerId });
  }

  submitPayment(): void {
    if (this.saving || this.paymentAmount === null || !Number.isFinite(this.paymentAmount) || this.paymentAmount <= 0) return;
    this.paymentSubmit.emit({
      folioId: this.folio.id,
      method: this.paymentMethod,
      amount: this.paymentAmount,
      description: this.paymentDescription.trim() || null
    });
    this.paymentAmount = null;
    this.paymentDescription = '';
  }

  isOpen(): boolean {
    return this.folio?.status === FolioStatus.OPEN;
  }

  trackAccrual(_: number, accrual: AccrualResponse): number {
    return accrual.id;
  }

  formatPaymentMethod(method: PaymentMethod): string {
    const labels: Record<PaymentMethod, string> = {
      [PaymentMethod.CASH]: 'Готівка',
      [PaymentMethod.CARD]: 'Картка',
      [PaymentMethod.BANK_TRANSFER]: 'Банківський переказ',
      [PaymentMethod.BALANCE]: 'З балансу'
    };
    return labels[method] ?? method;
  }

  private isValidPartyId(id: number | null): id is number {
    return id !== null && Number.isInteger(id) && id > 0;
  }
}
