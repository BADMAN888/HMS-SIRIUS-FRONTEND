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
  @Input() profiles: ProfileResponse[] = [];
  @Input() reservations: ReservationResponse[] = [];
  @Input() currentReservationId: number | null = null;
  @Input() legalEntities: LegalEntityResponse[] = [];
  @Input() saving = false;
  @Input() error = '';
  @Input() success = '';

  @Output() close = new EventEmitter<void>();
  @Output() partiesSave = new EventEmitter<FolioPartiesRequest>();
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
  payerSearch = '';
  payerResultsOpen = false;
  copiedRecipient = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['folio'] || changes['primaryGuestId']) {
      this.recipientId = this.primaryGuestId;
      this.payerReservationId = this.folio?.reservationId ?? this.currentReservationId;
      this.payerId = this.selectedPayerReservation?.primaryGuest?.id ?? this.folio?.payerId ?? this.primaryGuestId;
      this.serviceProviderId = this.folio?.serviceProviderId ?? null;
      this.paymentAmount = this.folio && Number(this.folio.balance) > 0 ? Number(this.folio.balance) : null;
      this.updatePayerLabel();
    }
    if (changes['profiles'] || changes['reservations']) {
      if (this.selectedPayerReservation) {
        this.payerId = this.selectedPayerReservation.primaryGuest?.id ?? null;
      }
      this.updatePayerLabel();
    }
    if (this.creationMode && (changes['creationMode'] || changes['legalEntities']) && this.serviceProviderId === null) {
      this.serviceProviderId = this.legalEntities.find(entity => entity.active)?.id ?? null;
    }
  }

  get activeAccruals(): AccrualResponse[] {
    return (this.folio?.accruals ?? []).filter(accrual => accrual.active);
  }

  get payerMatches(): ReservationResponse[] {
    const query = this.payerSearch.trim().toLocaleLowerCase();
    if (!query) return [];
    return this.reservations
      .filter(reservation => `${reservation.id} ${reservationGuestName(reservation)}`.toLocaleLowerCase().includes(query))
      .slice(0, 8);
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

  payerLabel(reservation: ReservationResponse | null): string {
    if (!reservation) return this.payerReservationId ? `${this.payerReservationId}` : '';
    const guestName = reservationGuestName(reservation);
    return guestName ? `${reservation.id} ${guestName}` : `${reservation.id} · Головного гостя не вказано`;
  }

  selectPayer(reservation: ReservationResponse): void {
    this.payerReservationId = reservation.id;
    this.payerId = reservation.primaryGuest?.id ?? null;
    this.payerSearch = '';
    this.payerResultsOpen = false;
  }

  onPayerSearch(query: string): void {
    this.payerSearch = query;
    this.payerId = null;
    this.payerReservationId = null;
    this.payerResultsOpen = true;
  }

  copyRecipient(): void {
    const value = this.primaryGuestId?.toString();
    if (!value || !navigator.clipboard) return;
    navigator.clipboard.writeText(value).then(() => {
      this.copiedRecipient = true;
      window.setTimeout(() => this.copiedRecipient = false, 1600);
    });
  }

  createFolio(): void {
    if (this.saving || !this.isValidPartyId(this.primaryGuestId) || !this.isValidPartyId(this.payerId) || !this.isValidPartyId(this.payerReservationId)) return;
    this.folioCreate.emit({
      recipientId: this.primaryGuestId,
      payerId: this.selectedPayerReservation?.primaryGuest?.id ?? this.payerId,
      reservationId: this.payerReservationId ?? this.currentReservationId ?? 0,
      serviceProviderId: this.serviceProviderId
    });
  }

  saveParties(): void {
    if (this.saving || !this.isValidPartyId(this.recipientId) || !this.isValidPartyId(this.payerId) || !this.isValidPartyId(this.payerReservationId)) return;
    this.partiesSave.emit({
      recipientId: this.recipientId,
      payerId: this.selectedPayerReservation?.primaryGuest?.id ?? this.payerId,
      reservationId: this.payerReservationId ?? 0,
      serviceProviderId: this.serviceProviderId
    });
  }

  submitPayment(): void {
    if (!this.folio || this.saving || this.paymentAmount === null || !Number.isFinite(this.paymentAmount) || this.paymentAmount <= 0) return;
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
      [PaymentMethod.BALANCE]: 'З балансу'
    };
    return labels[method] ?? method;
  }

  private isValidPartyId(id: number | null): id is number {
    return id !== null && Number.isInteger(id) && id > 0;
  }

  private updatePayerLabel(): void {
    if (this.payerReservationId === null || this.payerSearch) return;
    const reservation = this.reservations.find(item => item.id === this.payerReservationId);
    if (reservation) this.payerSearch = this.payerLabel(reservation);
  }
}

function reservationGuestName(reservation: ReservationResponse): string {
  const guest = reservation.primaryGuest;
  return guest ? [guest.lastName, guest.firstName].filter(Boolean).join(' ') : '';
}
