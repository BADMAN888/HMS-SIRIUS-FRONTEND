
import {
  Component,
  computed,
  effect,
  EventEmitter,
  Input,
  inject,
  OnInit,
  Output,
  signal
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { ProfileService } from '../../../../core/services/profile.service';
import { GuestProfileWorkflowService } from '../../../../core/services/guest-profile-workflow.service';
import { GuestDocumentService } from '../../../../core/services/guest-document.service';
import { ReservationService } from '../../../../core/services/reservation.service';
import { BalanceAccountService } from '../../../../core/services/balance-account.service';

import { ProfileResponse } from '../../../../core/models/profile/profile-response.model';
import { ProfileRequest } from '../../../../core/models/profile/profile-request.model';
import { ProfileReservationResponse } from '../../../../core/models/profile/profile-reservation-response.model';
import { GuestDocumentResponse } from '../../../../core/models/profile/guest-document-response.model';
import { GuestDocumentRequest } from '../../../../core/models/profile/guest-document-request.model';
import { ReservationResponse } from '../../../../core/models/reservation/reservation-response.model';
import { BalanceAccountResponse } from '../../../../core/models/billing/balance-account-response.model';
import { BalanceTransactionResponse } from '../../../../core/models/billing/balance-transaction-response.model';

import { Gender } from '../../../../core/models/enums/gender.enum';
import { Nationality } from '../../../../core/models/enums/nationality.enum';
import { DocumentType } from '../../../../core/models/enums/document-type.enum';
import { BalanceAccountStatus } from '../../../../core/models/enums/balance-account-status.enum';
import { BalanceTransactionType } from '../../../../core/models/enums/balance-transaction-type.enum';

type ProfileField =
  | 'firstName'
  | 'lastName'
  | 'middleName'
  | 'phoneNumber'
  | 'email'
  | 'gender'
  | 'dateOfBirth'
  | 'nationality'
  | 'address'
  | 'registrationAddress'
  | 'comment'
  | 'vip'
  | 'inBlackList';

interface ProfileForm {
  firstName: string;
  lastName: string;
  middleName: string;
  phoneNumber: string;
  email: string;
  gender: Gender | null;
  dateOfBirth: string;
  nationality: Nationality | null;
  address: string;
  registrationAddress: string;
  comment: string;
  vip: boolean;
  inBlackList: boolean;
}

interface DocumentForm {
  documentType: DocumentType;
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  issuingAuthority: string;
  recordNumber: string;
}

@Component({
  selector: 'app-profiles-tab',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './profiles-tab.html',
  styleUrl: './profiles-tab.scss'
})
export class ProfilesTab implements OnInit {
  private tabIsActive = false;
  private initialized = false;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly profileService = inject(ProfileService);
  private readonly guestDocumentService = inject(GuestDocumentService);
  private readonly reservationService = inject(ReservationService);
  private readonly guestProfileWorkflow = inject(GuestProfileWorkflowService);
  private readonly balanceAccountService = inject(BalanceAccountService);

  @Output() readonly returnToReservation = new EventEmitter<void>();

  @Input()
  set active(value: boolean) {
    const becameActive = value && !this.tabIsActive;
    this.tabIsActive = value;
    if (becameActive && this.initialized) {
      this.refreshOnTabActivation();
    }
  }

  private requestedProfileId: number | null = null;

  @Input()
  set profileToSelect(profileId: number | null) {
    if (profileId === null) {
      return;
    }
    this.requestedProfileId = profileId;
    this.selectRequestedProfile();
  }

  readonly reservation = signal<ReservationResponse | null>(null);
  readonly profiles = signal<ProfileResponse[]>([]);
  readonly selectedProfileId = signal<number | null>(null);

  readonly selectedProfile = computed(
    () => this.profiles().find(p => p.id === this.selectedProfileId()) ?? null
  );
  readonly profileToDisplay = computed<ProfileResponse | null>(() => {
    const profile = this.selectedProfile();

    if (profile || !this.creatingProfile()) {
      return profile;
    }

    return {
      id: 0,
      firstName: '',
      lastName: '',
      middleName: null,
      phoneNumber: null,
      email: null,
      gender: null,
      dateOfBirth: null,
      nationality: null,
      address: null,
      registrationAddress: null,
      comment: null,
      vip: false,
      inBlackList: false,
      guestDocuments: []
    };
  });

  readonly history = signal<ProfileReservationResponse[]>([]);

  readonly loading = signal(true);
  readonly savingProfile = signal(false);
  readonly creatingProfile = signal(false);
  readonly savingDocument = signal(false);
  readonly loadingHistory = signal(false);
  readonly balanceAccounts = signal<BalanceAccountResponse[]>([]);
  readonly balanceTransactions = signal<Record<number, BalanceTransactionResponse[]>>({});
  readonly accountAmounts = signal<Record<number, string>>({});
  readonly accountDescriptions = signal<Record<number, string>>({});
  readonly expandedAccountId = signal<number | null>(null);
  readonly loadingBalanceAccounts = signal(false);
  readonly balanceActionBusy = signal(false);
  readonly balanceError = signal('');
  readonly balanceSuccess = signal('');

  readonly error = signal('');
  readonly success = signal('');

  readonly genderOptions = [
    { value: Gender.MALE, label: 'Чоловіча' },
    { value: Gender.FEMALE, label: 'Жіноча' }
  ];

  readonly nationalityOptions = Object.values(Nationality).map(value => ({
    value,
    label: this.formatNationality(value)
  }));

  readonly documentTypes = [
    { value: DocumentType.PASSPORT, label: 'Паспорт' },
    { value: DocumentType.ID_CARD, label: 'ID-картка' },
    { value: DocumentType.DRIVER_LICENSE, label: 'Водійське посвідчення' },
    { value: DocumentType.RESIDENCE_PERMIT, label: 'Посвідка на проживання' },
    { value: DocumentType.VISA, label: 'Віза' },
    { value: DocumentType.BIRTH_CERTIFICATE, label: 'Свідоцтво про народження' },
    { value: DocumentType.OTHER, label: 'Інший документ' }
  ];

  readonly balanceAccountStatuses = BalanceAccountStatus;

  readonly profileForm = signal<ProfileForm>(this.emptyProfileForm());
  readonly createTargetLabel = signal('');

  private activeCreateRequestId: number | null = null;
  private createReturnToReservation = true;
  private createTarget: 'primary' | 'additional' = 'additional';

  private readonly createDraftEffect = effect(() => {
    const intent = this.guestProfileWorkflow.pendingDraft();

    if (!intent || intent.requestId === this.activeCreateRequestId) {
      return;
    }

    this.activeCreateRequestId = intent.requestId;
    this.createReturnToReservation = intent.returnToReservation;
    this.createTarget = intent.target;
    this.creatingProfile.set(true);
    this.selectedProfileId.set(null);
    this.history.set([]);
    this.cancelDocumentForm();
    this.error.set('');
    this.success.set('');
    this.createTargetLabel.set(
      intent.target === 'primary'
        ? 'Основний гість бронювання'
        : 'Додатковий гість бронювання'
    );
    this.profileForm.set({
      ...this.emptyProfileForm(),
      firstName: intent.firstName,
      lastName: intent.lastName,
      middleName: intent.middleName,
      phoneNumber: intent.phoneNumber,
      email: intent.email
    });
  });

  readonly documentForm = signal<DocumentForm>(this.emptyDocumentForm());
  readonly editingDocumentId = signal<number | null>(null);
  readonly showDocumentForm = signal(false);

  readonly documentTypeLabels: Record<DocumentType, string> = {
    [DocumentType.PASSPORT]: 'Паспорт',
    [DocumentType.ID_CARD]: 'ID-картка',
    [DocumentType.DRIVER_LICENSE]: 'Водійське посвідчення',
    [DocumentType.RESIDENCE_PERMIT]: 'Посвідка на проживання',
    [DocumentType.VISA]: 'Віза',
    [DocumentType.BIRTH_CERTIFICATE]: 'Свідоцтво про народження',
    [DocumentType.OTHER]: 'Інший документ'
  };

  ngOnInit(): void {
    this.initialized = true;
    this.route.paramMap.subscribe(params => this.loadRoute(params.get('id')));
  }

  private refreshOnTabActivation(): void {
    if (this.creatingProfile()) return;
    const reservationId = Number(this.route.snapshot.paramMap.get('id'));
    if (Number.isInteger(reservationId) && reservationId > 0) {
      this.loadProfiles(reservationId);
    }
  }

  private loadRoute(idParam: string | null): void {
    const reservationId = Number(idParam);

    if (idParam === 'new') {
      this.reservation.set(null);
      this.profiles.set([]);
      this.loading.set(false);
      return;
    }

    if (!idParam || !Number.isInteger(reservationId) || reservationId <= 0) {
      this.loading.set(false);
      this.error.set('Профайли будуть доступні після створення бронювання.');
      return;
    }

    this.loadProfiles(reservationId);
  }

  private loadProfiles(reservationId: number): void {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      reservation: this.reservationService.getById(reservationId),
      allProfiles: this.profileService.getAll()
    }).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: ({ reservation, allProfiles }) => {
        this.reservation.set(reservation);
        const guestIds = new Set<number>([
          ...(reservation.primaryGuest ? [reservation.primaryGuest.id] : []),
          ...(reservation.guestIds ?? [])
        ]);

        const reservationProfiles = allProfiles.filter(
          profile => guestIds.has(profile.id)
        );

        this.profiles.set(reservationProfiles);

        const requestedProfileSelected = this.selectRequestedProfile();
        if (!requestedProfileSelected && reservationProfiles.length > 0) {
          const currentProfile = reservationProfiles.find(
            profile => profile.id === this.selectedProfileId()
          );
          if (currentProfile) {
            this.loadHistory(currentProfile.id);
            this.loadBalanceAccounts(currentProfile.id);
          } else {
            this.selectProfile(reservationProfiles[0]);
          }
        }
      },
      error: error => {
        this.error.set(
          error?.error?.message ||
          error?.message ||
          `Не вдалося завантажити профайли. HTTP ${error?.status || ''}`
        );
      }
    });
  }

  private formatNationality(value: Nationality): string {
    return value
      .split('_')
      .map(part => part.charAt(0) + part.slice(1).toLowerCase())
      .join(' ');
  }

  getFullName(profile: ProfileResponse): string {
    return [
      profile.lastName,
      profile.firstName,
      profile.middleName
    ].filter(Boolean).join(' ');
  }

  private selectRequestedProfile(): boolean {
    if (this.requestedProfileId === null) {
      return false;
    }
    const profile = this.profiles().find(item => item.id === this.requestedProfileId);
    if (!profile) {
      return false;
    }
    this.selectProfile(profile);
    this.requestedProfileId = null;
    return true;
  }

  selectProfile(profile: ProfileResponse): void {
    this.selectedProfileId.set(profile.id);
    this.profileForm.set(this.toProfileForm(profile));
    this.history.set([]);
    this.success.set('');
    this.error.set('');

    this.cancelDocumentForm();
    this.loadHistory(profile.id);
    this.loadBalanceAccounts(profile.id);
  }

  openReservationFromHistory(reservationId: number): void {
    if (!Number.isInteger(reservationId) || reservationId <= 0) return;
    this.router.navigate(['/reservations', reservationId]);
  }

  private loadHistory(profileId: number): void {
    this.loadingHistory.set(true);

    this.profileService.getReservations(profileId).pipe(
      finalize(() => this.loadingHistory.set(false))
    ).subscribe({
      next: history => this.history.set(history),
      error: () => this.history.set([])
    });
  }

  updateProfileField(field: ProfileField, value: string | boolean): void {
    this.profileForm.update(form => {
      if (field === 'gender') {
        return {
          ...form,
          gender: value ? value as Gender : null
        };
      }

      if (field === 'nationality') {
        return {
          ...form,
          nationality: value ? value as Nationality : null
        };
      }

      if (field === 'vip' || field === 'inBlackList') {
        return { ...form, [field]: Boolean(value) };
      }

      return {
        ...form,
        [field]: value as string
      };
    });
  }

  saveProfile(): void {
    const profile = this.selectedProfile();

    if ((!profile && !this.creatingProfile()) || this.savingProfile()) {
      return;
    }

    const form = this.profileForm();

    if (!form.firstName.trim() || !form.lastName.trim()) {
      this.error.set('Ім’я та прізвище обов’язкові.');
      return;
    }

    const request: ProfileRequest = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      middleName: form.middleName.trim() || null,
      phoneNumber: form.phoneNumber.trim() || null,
      email: form.email.trim() || null,
      gender: form.gender,
      dateOfBirth: form.dateOfBirth || null,
      nationality: form.nationality,
      address: form.address.trim() || null,
      registrationAddress: form.registrationAddress.trim() || null,
      comment: form.comment.trim() || null,
      vip: form.vip,
      inBlackList: form.inBlackList
    };

    this.savingProfile.set(true);
    this.error.set('');
    this.success.set('');

    const saveRequest = profile
      ? this.profileService.update(profile.id, request)
      : this.profileService.create(request);

    saveRequest.pipe(
      finalize(() => this.savingProfile.set(false))
    ).subscribe({
      next: updated => {
        if (!profile && this.reservation()) {
          const reservation = this.reservation()!;
          const guestIds = new Set<number>([
            ...(reservation.guestIds ?? []),
            ...(reservation.primaryGuest ? [reservation.primaryGuest.id] : []),
            updated.id
          ]);
          const primaryGuestId = this.createTarget === 'primary'
            ? updated.id
            : reservation.primaryGuest?.id ?? updated.id;

          this.reservationService.updateGuests(
            reservation.id,
            primaryGuestId,
            [...guestIds]
          ).subscribe({
            next: updatedReservation => {
              this.reservation.set(updatedReservation);
              this.finishCreatedProfile(updated);
            },
            error: error => {
              this.profiles.update(items => [...items, updated]);
              this.creatingProfile.set(false);
              this.selectedProfileId.set(updated.id);
              this.profileForm.set(this.toProfileForm(updated));
              this.error.set(
                error?.error?.message ||
                'Профайл створено, але його не вдалося прив’язати до бронювання.'
              );
            }
          });
          return;
        }

        if (!profile) {
          this.finishCreatedProfile(updated);
          return;
        }

        this.profiles.update(items =>
          items.map(item => item.id === updated.id ? updated : item)
        );
        this.profileForm.set(this.toProfileForm(updated));
        this.success.set('Профайл успішно оновлено.');
      },
      error: error => {
        this.error.set(
          error?.error?.message ||
          error?.message ||
          `Не вдалося оновити профайл. HTTP ${error?.status || ''}`
        );
      }
    });
  }

  private finishCreatedProfile(profile: ProfileResponse): void {
    this.profiles.update(items => [
      ...items.filter(item => item.id !== profile.id),
      profile
    ]);
    this.creatingProfile.set(false);
    this.selectProfile(profile);
    this.success.set('Профайл створено та додано до бронювання.');

    if (this.activeCreateRequestId !== null) {
      const requestId = this.activeCreateRequestId;
      this.guestProfileWorkflow.complete(profile, requestId);
      this.activeCreateRequestId = null;

      if (this.createReturnToReservation) {
        this.returnToReservation.emit();
      }
    }
  }

  addProfile(): void {
    this.guestProfileWorkflow.start({
      target: 'additional',
      returnToReservation: false,
      firstName: '',
      lastName: '',
      middleName: '',
      phoneNumber: '',
      email: ''
    });
  }

  cancelCreateProfile(): void {
    const shouldReturn = this.createReturnToReservation;

    if (this.activeCreateRequestId !== null) {
      this.guestProfileWorkflow.cancel(this.activeCreateRequestId);
      this.activeCreateRequestId = null;
    }

    this.creatingProfile.set(false);
    this.profileForm.set(this.emptyProfileForm());
    if (shouldReturn) {
      this.returnToReservation.emit();
    }
  }

  removeProfileFromReservation(profile: ProfileResponse): void {
    if (!window.confirm(`Відв’язати профайл ${this.getFullName(profile)} від бронювання?`)) {
      return;
    }

    const reservation = this.reservation();

    if (!reservation) {
      this.guestProfileWorkflow.removeFromDraft(profile.id);
      this.removeProfileFromLocalList(profile.id);
      return;
    }

    const guestIds = new Set<number>([
      ...(reservation.guestIds ?? []),
      ...(reservation.primaryGuest ? [reservation.primaryGuest.id] : [])
    ]);

    if (!guestIds.has(profile.id)) {
      return;
    }

    guestIds.delete(profile.id);
    const primaryGuestId = reservation.primaryGuest?.id === profile.id
      ? [...guestIds][0] ?? null
      : reservation.primaryGuest?.id ?? null;

    this.savingProfile.set(true);
    this.error.set('');
    this.reservationService.updateGuests(
      reservation.id,
      primaryGuestId,
      [...guestIds]
    ).pipe(
      finalize(() => this.savingProfile.set(false))
    ).subscribe({
      next: updatedReservation => {
        this.reservation.set(updatedReservation);
        this.guestProfileWorkflow.syncReservationGuests(
          updatedReservation.primaryGuest?.id ?? null,
          updatedReservation.guestIds ?? []
        );
        this.removeProfileFromLocalList(profile.id);
        this.success.set('Профайл відв’язано від бронювання.');
      },
      error: error => {
        this.error.set(
          error?.error?.message ||
          'Не вдалося відв’язати профайл від бронювання.'
        );
      }
    });
  }

  private removeProfileFromLocalList(profileId: number): void {
    const nextProfiles = this.profiles().filter(item => item.id !== profileId);
    this.profiles.set(nextProfiles);

    if (this.selectedProfileId() === profileId) {
      if (nextProfiles.length > 0) {
        this.selectProfile(nextProfiles[0]);
      } else {
        this.selectedProfileId.set(null);
        this.profileForm.set(this.emptyProfileForm());
        this.history.set([]);
        this.balanceAccounts.set([]);
      }
    }
  }

  private loadBalanceAccounts(profileId: number): void {
    const hotelId = this.reservation()?.room?.hotelId;

    this.balanceError.set('');
    this.balanceSuccess.set('');

    if (!hotelId) {
      this.balanceAccounts.set([]);
      return;
    }

    this.loadingBalanceAccounts.set(true);
    this.balanceAccountService.getAllByProfileAndHotel(profileId, hotelId).pipe(
      finalize(() => this.loadingBalanceAccounts.set(false))
    ).subscribe({
      next: accounts => {
        this.balanceAccounts.set(accounts);
        const expandedAccountId = this.expandedAccountId();
        if (expandedAccountId !== null && accounts.some(account => account.id === expandedAccountId)) {
          this.loadAccountTransactions(expandedAccountId);
        } else if (expandedAccountId !== null) {
          this.expandedAccountId.set(null);
        }
      },
      error: error => {
        this.balanceAccounts.set([]);
        this.balanceError.set(
          error?.error?.message ||
          'Не вдалося завантажити авансові рахунки.'
        );
      }
    });
  }

  createBalanceAccount(): void {
    const profile = this.selectedProfile();
    const hotelId = this.reservation()?.room?.hotelId;

    if (!profile || !hotelId || this.balanceActionBusy()) {
      return;
    }

    this.balanceActionBusy.set(true);
    this.balanceError.set('');
    this.balanceAccountService.createNew(profile.id, hotelId).pipe(
      finalize(() => this.balanceActionBusy.set(false))
    ).subscribe({
      next: account => {
        this.balanceAccounts.update(accounts => [account, ...accounts]);
        this.balanceSuccess.set('Авансовий рахунок створено.');
      },
      error: error => {
        this.balanceError.set(
          error?.error?.message ||
          'Не вдалося створити авансовий рахунок.'
        );
      }
    });
  }

  setAccountAmount(accountId: number, value: string): void {
    this.accountAmounts.update(values => ({ ...values, [accountId]: value }));
  }

  setAccountDescription(accountId: number, value: string): void {
    this.accountDescriptions.update(values => ({ ...values, [accountId]: value }));
  }

  depositToAccount(account: BalanceAccountResponse): void {
    const amount = Number(this.accountAmounts()[account.id]);

    if (!Number.isFinite(amount) || amount <= 0 || this.balanceActionBusy()) {
      this.balanceError.set('Вкажіть суму депозиту, більшу за нуль.');
      return;
    }

    this.runBalanceOperation(
      account,
      'deposit',
      'Депозит внесено.'
    );
  }

  refundDeposit(account: BalanceAccountResponse): void {
    const amount = Number(this.accountAmounts()[account.id]);

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > account.balance ||
      this.balanceActionBusy()
    ) {
      this.balanceError.set('Вкажіть суму повернення в межах доступного залишку.');
      return;
    }

    this.runBalanceOperation(
      account,
      'refund',
      'Депозит повернуто.'
    );
  }

  private runBalanceOperation(
    account: BalanceAccountResponse,
    operation: 'deposit' | 'refund',
    successMessage: string
  ): void {
    const request = {
      amount: Number(this.accountAmounts()[account.id]),
      description: this.accountDescriptions()[account.id]?.trim() || null
    };
    const operation$ = operation === 'deposit'
      ? this.balanceAccountService.depositToAccount(account.id, request)
      : this.balanceAccountService.debit(account.id, request);

    this.balanceActionBusy.set(true);
    this.balanceError.set('');
    operation$.pipe(
      finalize(() => this.balanceActionBusy.set(false))
    ).subscribe({
      next: updated => {
        this.updateBalanceAccount(updated);
        this.accountAmounts.update(values => ({ ...values, [account.id]: '' }));
        this.accountDescriptions.update(values => ({ ...values, [account.id]: '' }));
        this.balanceSuccess.set(successMessage);

        if (this.expandedAccountId() === account.id) {
          this.loadAccountTransactions(account.id);
        }
      },
      error: error => {
        this.balanceError.set(
          error?.error?.message ||
          'Не вдалося виконати операцію з авансовим рахунком.'
        );
      }
    });
  }

  closeBalanceAccount(account: BalanceAccountResponse): void {
    if (account.balance !== 0 || this.balanceActionBusy()) {
      return;
    }

    if (!window.confirm('Закрити порожній авансовий рахунок?')) {
      return;
    }

    this.balanceActionBusy.set(true);
    this.balanceError.set('');
    this.balanceAccountService.close(account.id).pipe(
      finalize(() => this.balanceActionBusy.set(false))
    ).subscribe({
      next: updated => {
        this.updateBalanceAccount(updated);
        this.balanceSuccess.set('Авансовий рахунок закрито.');
      },
      error: error => {
        this.balanceError.set(
          error?.error?.message ||
          'Не вдалося закрити авансовий рахунок.'
        );
      }
    });
  }

  toggleAccountTransactions(accountId: number): void {
    if (this.expandedAccountId() === accountId) {
      this.expandedAccountId.set(null);
      return;
    }

    this.expandedAccountId.set(accountId);
    this.loadAccountTransactions(accountId);
  }

  private loadAccountTransactions(accountId: number): void {
    this.balanceAccountService.getTransactions(accountId).subscribe({
      next: transactions => this.balanceTransactions.update(items => ({
        ...items,
        [accountId]: transactions
      })),
      error: () => this.balanceError.set('Не вдалося завантажити рух коштів.')
    });
  }

  private updateBalanceAccount(account: BalanceAccountResponse): void {
    this.balanceAccounts.update(accounts =>
      accounts.map(item => item.id === account.id ? account : item)
    );
  }

  getBalanceTransactionLabel(type: BalanceTransactionType): string {
    const labels: Record<BalanceTransactionType, string> = {
      [BalanceTransactionType.DEPOSIT]: 'Депозит',
      [BalanceTransactionType.FOLIO_PAYMENT]: 'Оплата рахунку',
      [BalanceTransactionType.REFUND]: 'Повернення на баланс',
      [BalanceTransactionType.ADJUSTMENT_CREDIT]: 'Коригування зі збільшенням',
      [BalanceTransactionType.ADJUSTMENT_DEBIT]: 'Повернення або списання'
    };

    return labels[type];
  }

  isCreditTransaction(type: BalanceTransactionType): boolean {
    return type === BalanceTransactionType.DEPOSIT
      || type === BalanceTransactionType.REFUND
      || type === BalanceTransactionType.ADJUSTMENT_CREDIT;
  }

  openNewDocumentForm(): void {
    this.documentForm.set(this.emptyDocumentForm());
    this.editingDocumentId.set(null);
    this.showDocumentForm.set(true);
    this.error.set('');
  }

  editDocument(document: GuestDocumentResponse): void {
    this.documentForm.set({
      documentType: document.documentType,
      documentNumber: document.documentNumber,
      issueDate: document.issueDate ?? '',
      expiryDate: document.expiryDate ?? '',
      issuingAuthority: document.issuingAuthority ?? '',
      recordNumber: document.recordNumber ?? ''
    });

    this.editingDocumentId.set(document.id);
    this.showDocumentForm.set(true);
    this.error.set('');
  }

  updateDocumentField(
    field: keyof DocumentForm,
    value: string
  ): void {
    this.documentForm.update(form => ({
      ...form,
      [field]: field === 'documentType'
        ? value as DocumentType
        : value
    }));
  }

  cancelDocumentForm(): void {
    this.showDocumentForm.set(false);
    this.editingDocumentId.set(null);
    this.documentForm.set(this.emptyDocumentForm());
  }

  saveDocument(): void {
    const profile = this.selectedProfile();

    if (!profile || this.savingDocument()) {
      return;
    }

    const form = this.documentForm();

    if (!form.documentNumber.trim()) {
      this.error.set('Вкажіть номер документа.');
      return;
    }

    const request: GuestDocumentRequest = {
      documentType: form.documentType,
      documentNumber: form.documentNumber.trim(),
      issueDate: form.issueDate || null,
      expiryDate: form.expiryDate || null,
      issuingAuthority: form.issuingAuthority.trim() || null,
      recordNumber: form.recordNumber.trim() || null
    };

    this.savingDocument.set(true);
    this.error.set('');

    const documentId = this.editingDocumentId();

    const operation = documentId
      ? this.guestDocumentService.update(documentId, request)
      : this.guestDocumentService.create(profile.id, request);

    operation.pipe(
      finalize(() => this.savingDocument.set(false))
    ).subscribe({
      next: () => {
        this.refreshSelectedProfile();
        this.cancelDocumentForm();
        this.success.set(
          documentId
            ? 'Документ успішно оновлено.'
            : 'Документ успішно додано.'
        );
      },
      error: error => {
        this.error.set(
          error?.error?.message ||
          error?.message ||
          `Не вдалося зберегти документ. HTTP ${error?.status || ''}`
        );
      }
    });
  }

  deleteDocument(document: GuestDocumentResponse): void {
    if (!confirm(`Видалити документ ${document.documentNumber}?`)) {
      return;
    }

    this.error.set('');

    this.guestDocumentService.delete(document.id).subscribe({
      next: () => {
        this.refreshSelectedProfile();
        this.success.set('Документ видалено.');
      },
      error: error => {
        this.error.set(
          error?.error?.message ||
          error?.message ||
          `Не вдалося видалити документ. HTTP ${error?.status || ''}`
        );
      }
    });
  }

  private refreshSelectedProfile(): void {
    const profileId = this.selectedProfileId();

    if (!profileId) {
      return;
    }

    this.profileService.getById(profileId).subscribe({
      next: updated => {
        this.profiles.update(items =>
          items.map(item => item.id === updated.id ? updated : item)
        );
      },
      error: error => {
        this.error.set(
          error?.error?.message ||
          'Не вдалося оновити список документів.'
        );
      }
    });
  }

  private toProfileForm(profile: ProfileResponse): ProfileForm {
    return {
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      middleName: profile.middleName ?? '',
      phoneNumber: profile.phoneNumber ?? '',
      email: profile.email ?? '',
      gender: profile.gender ?? null,
      dateOfBirth: profile.dateOfBirth ?? '',
      nationality: profile.nationality ?? null,
      address: profile.address ?? '',
      registrationAddress: profile.registrationAddress ?? '',
      comment: profile.comment ?? '',
      vip: profile.vip ?? false,
      inBlackList: profile.inBlackList ?? false
    };
  }

  private emptyProfileForm(): ProfileForm {
    return {
      firstName: '',
      lastName: '',
      middleName: '',
      phoneNumber: '',
      email: '',
      gender: null,
      dateOfBirth: '',
      nationality: null,
      address: '',
      registrationAddress: '',
      comment: '',
      vip: false,
      inBlackList: false
    };
  }

  private emptyDocumentForm(): DocumentForm {
    return {
      documentType: DocumentType.PASSPORT,
      documentNumber: '',
      issueDate: '',
      expiryDate: '',
      issuingAuthority: '',
      recordNumber: ''
    };
  }
}
