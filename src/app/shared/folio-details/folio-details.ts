import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AccrualResponse } from '../../core/models/billing/accrual-response.model';
import { FolioPartiesRequest } from '../../core/models/billing/folio-parties-request.model';
import { FolioResponse } from '../../core/models/billing/folio-response.model';
import { LegalEntityResponse } from '../../core/models/legal-entity-response.model';
import { PaymentRequest } from '../../core/models/billing/payment-request.model';
import { FolioStatus } from '../../core/models/enums/folio-status.enum';
import { PaymentMethod } from '../../core/models/enums/payment-method.enum';
import { ProfileResponse } from '../../core/models/profile/profile-response.model';
import { ReservationResponse } from '../../core/models/reservation/reservation-response.model';

@Component({
  selector: 'app-folio-details',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './folio-details.html',
  styleUrl: './folio-details.scss'
})
export class FolioDetails implements OnChanges {
  @Input() folio: FolioResponse | null = null;
  @Input() creationMode = false;
  @Input() draftAccruals: AccrualResponse[] = [];
  @Input() draftTotal = 0;
  @Input() primaryGuestId: number | null = null;
  @Input() primaryGuest: ProfileResponse | null = null;
  @Input() availableBalance = 0;
  @Input() profiles: ProfileResponse[] = [];
  @Input() reservations: ReservationResponse[] = [];
  @Input() currentReservationId: number | null = null;
  @Input() legalEntities: LegalEntityResponse[] = [];
  @Input() saving = false;
  @Input() error = '';
  @Input() success = '';

  @Output() close = new EventEmitter<void>();
  @Output() partiesSave = new EventEmitter<FolioPartiesRequest>();
  @Output() payerChanged = new EventEmitter<number | null>();
  @Output() folioCreate = new EventEmitter<FolioPartiesRequest>();
  @Output() paymentSubmit = new EventEmitter<PaymentRequest>();
  @Output() accrualCancel = new EventEmitter<AccrualResponse>();
  @Output() folioClose = new EventEmitter<void>();
  @Output() folioReopen = new EventEmitter<void>();
  @Output() folioDelete = new EventEmitter<void>();

  recipientId: number | null = null;
  payerId: number | null = null;
  payerReservationId: number | null = null;
  serviceProviderId: number | null = null;
  paymentMethods = Object.values(PaymentMethod);
  paymentMethod: PaymentMethod = PaymentMethod.CASH;
  paymentAmount: number | null = null;
  paymentDescription = '';
  readonly today = new Date();
  copiedRecipient = false;
  private balancePaymentIdempotencyKey: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['success'] && this.success) this.balancePaymentIdempotencyKey = null;
    if (changes['folio'] || changes['primaryGuestId'] || changes['currentReservationId']) {
      this.recipientId = this.folio?.recipientId ?? this.primaryGuestId;
      this.payerReservationId = this.folio?.reservationId ?? this.currentReservationId;
      this.payerId = this.folio?.payerId ?? this.selectedPayerReservation?.primaryGuest?.id ?? this.primaryGuestId;
      this.serviceProviderId = this.folio?.serviceProviderId ?? null;
      this.paymentAmount = this.folio && Number(this.folio.balance) > 0 ? Number(this.folio.balance) : null;
    }
    if ((changes['availableBalance'] || changes['folio']) && this.paymentMethod === PaymentMethod.BALANCE) {
      this.setBalancePaymentAmount();
    }
    if (changes['profiles'] || changes['reservations']) {
      if (!this.recipientProfiles.some(profile => profile.id === this.recipientId)) {
        this.recipientId = this.recipientProfiles[0]?.id ?? null;
      }
      if (this.payerId === null) this.payerId = this.selectedPayerReservation?.primaryGuest?.id ?? this.primaryGuestId;
    }
    if (this.creationMode && (changes['creationMode'] || changes['legalEntities']) && this.serviceProviderId === null) {
      this.serviceProviderId = this.legalEntities.find(entity => entity.active)?.id ?? null;
    }
  }

  get activeAccruals(): AccrualResponse[] {
    return (this.folio?.accruals ?? []).filter(accrual => accrual.active);
  }

  get recipientProfiles(): ProfileResponse[] {
    const reservationId = this.payerReservationId ?? this.folio?.reservationId ?? this.currentReservationId;
    const reservation = this.reservations.find(item => item.id === reservationId);
    if (!reservation) return this.primaryGuest ? [this.primaryGuest] : [];

    const guestIds = new Set(reservation.guestIds ?? []);
    if (reservation.primaryGuest) guestIds.add(reservation.primaryGuest.id);
    const profiles = this.profiles.filter(profile => guestIds.has(profile.id));
    if (reservation.primaryGuest && !profiles.some(profile => profile.id === reservation.primaryGuest?.id)) {
      profiles.unshift(reservation.primaryGuest);
    }
    return profiles;
  }

  get payerProfiles(): ProfileResponse[] {
    const profiles = [...this.profiles];
    if (this.primaryGuest && !profiles.some(profile => profile.id === this.primaryGuest?.id)) {
      profiles.unshift(this.primaryGuest);
    }
    return profiles;
  }

  get partyChangesPending(): boolean {
    if (!this.folio) return false;
    return this.recipientId !== this.folio.recipientId
      || this.payerId !== this.folio.payerId
      || this.recipientId === null
      || this.payerId === null
      || this.payerReservationId !== this.folio.reservationId
      || this.serviceProviderId !== this.folio.serviceProviderId;
  }

  get paymentExceedsFolioBalance(): boolean {
    return this.paymentAmount !== null && this.paymentAmount > Number(this.folio?.balance ?? 0);
  }

  get paymentExceedsPayerBalance(): boolean {
    return this.paymentMethod === PaymentMethod.BALANCE
      && this.paymentAmount !== null
      && this.paymentAmount > this.availableBalance;
  }

  get selectedPayerReservation(): ReservationResponse | null {
    return this.reservations.find(reservation => reservation.id === this.payerReservationId) ?? null;
  }

  profileName(profile: ProfileResponse | null): string {
    if (!profile) return '';
    return [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ');
  }

  profileLabel(profile: ProfileResponse | null): string {
    return profile ? `${profile.id} ${this.profileName(profile)}` : '';
  }

  selectPayer(profileId: number | null): void {
    if (this.payerId !== profileId) this.balancePaymentIdempotencyKey = null;
    this.payerId = profileId;
    this.payerChanged.emit(profileId);
  }

  copyRecipient(): void {
    const value = this.recipientId?.toString();
    if (!value || !navigator.clipboard) return;
    navigator.clipboard.writeText(value).then(() => {
      this.copiedRecipient = true;
      window.setTimeout(() => this.copiedRecipient = false, 1600);
    });
  }

  createFolio(): void {
    if (this.saving || !this.isValidPartyId(this.recipientId) || !this.isValidPartyId(this.payerId) || !this.isValidPartyId(this.payerReservationId)) return;
    this.folioCreate.emit({
      recipientId: this.recipientId,
      payerId: this.payerId,
      reservationId: this.payerReservationId ?? this.currentReservationId ?? 0,
      serviceProviderId: this.serviceProviderId
    });
  }

  saveParties(): void {
    if (this.saving || !this.isValidPartyId(this.recipientId) || !this.isValidPartyId(this.payerId) || !this.isValidPartyId(this.payerReservationId)) return;
    if (!this.recipientProfiles.some(profile => profile.id === this.recipientId)) return;
    this.partiesSave.emit({
      recipientId: this.recipientId,
      payerId: this.payerId,
      reservationId: this.payerReservationId ?? 0,
      serviceProviderId: this.serviceProviderId
    });
  }

  submitPayment(): void {
    if (!this.folio || this.saving || this.paymentAmount === null || !Number.isFinite(this.paymentAmount) || this.paymentAmount <= 0) return;
    if (this.partyChangesPending || this.paymentExceedsFolioBalance || this.paymentExceedsPayerBalance) return;
    const idempotencyKey = this.balancePaymentIdempotencyKey ??= this.createIdempotencyKey();
    this.paymentSubmit.emit({
      folioId: this.folio.id,
      method: this.paymentMethod,
      amount: this.paymentAmount,
      description: this.paymentDescription.trim() || null,
      idempotencyKey
    });
  }

  onPaymentAmountChange(amount: number | null): void {
    if (this.paymentAmount !== amount) this.balancePaymentIdempotencyKey = null;
    this.paymentAmount = amount;
  }

  onPaymentDescriptionChange(description: string): void {
    if (this.paymentDescription !== description) this.balancePaymentIdempotencyKey = null;
    this.paymentDescription = description;
  }

  onPaymentMethodChange(method: PaymentMethod): void {
    if (this.paymentMethod !== method) this.balancePaymentIdempotencyKey = null;
    this.paymentMethod = method;
    if (method === PaymentMethod.BALANCE) {
      this.setBalancePaymentAmount();
    } else if (this.folio) {
      this.paymentAmount = Number(this.folio.balance) > 0 ? Number(this.folio.balance) : null;
    }
  }

  get paymentAmountLimit(): number {
    const folioBalance = Number(this.folio?.balance ?? 0);
    return this.paymentMethod === PaymentMethod.BALANCE
      ? Math.min(folioBalance, this.availableBalance)
      : folioBalance;
  }

  private setBalancePaymentAmount(): void {
    const limit = this.paymentAmountLimit;
    this.paymentAmount = limit > 0 ? Math.round(limit * 100) / 100 : null;
  }

  private createIdempotencyKey(): string {
    return globalThis.crypto?.randomUUID?.()
      ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  isOpen(): boolean {
    return !this.creationMode && this.folio?.status === FolioStatus.OPEN;
  }

  trackAccrual(_: number, accrual: AccrualResponse): number {
    return accrual.id;
  }

  formatPaymentMethod(method: PaymentMethod): string {
    const labels: Record<PaymentMethod, string> = {
      [PaymentMethod.CASH]: 'Готівка',
      [PaymentMethod.CARD]: 'Картка',
      [PaymentMethod.BANK_TRANSFER]: 'Банківський переказ',
      [PaymentMethod.BALANCE]: 'З авансу платника'
    };
    return labels[method] ?? method;
  }

  private isValidPartyId(id: number | null): id is number {
    return id !== null && Number.isInteger(id) && id > 0;
  }
}
