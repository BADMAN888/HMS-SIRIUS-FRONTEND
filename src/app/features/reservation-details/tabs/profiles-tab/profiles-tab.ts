import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { ProfileService } from '../../../../core/services/profile.service';
import { GuestDocumentService } from '../../../../core/services/guest-document.service';
import { ReservationService } from '../../../../core/services/reservation.service';

import { ProfileResponse } from '../../../../core/models/profile/profile-response.model';
import { ProfileRequest } from '../../../../core/models/profile/profile-request.model';
import { ProfileReservationResponse } from '../../../../core/models/profile/profile-reservation-response.model';
import { GuestDocumentResponse } from '../../../../core/models/profile/guest-document-response.model';
import { GuestDocumentRequest } from '../../../../core/models/profile/guest-document-request.model';

import { Gender } from '../../../../core/models/enums/gender.enum';
import { DocumentType } from '../../../../core/models/enums/document-type.enum';

type ProfileField =
  | 'firstName'
  | 'lastName'
  | 'middleName'
  | 'phoneNumber'
  | 'email'
  | 'gender'
  | 'dateOfBirth'
  | 'placeOfBirth'
  | 'citizenship'
  | 'taxNumber'
  | 'address'
  | 'registrationAddress';

interface ProfileForm {
  firstName: string;
  lastName: string;
  middleName: string;
  phoneNumber: string;
  email: string;
  gender: Gender | null;
  dateOfBirth: string;
  placeOfBirth: string;
  citizenship: string;
  taxNumber: string;
  address: string;
  registrationAddress: string;
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
  imports: [FormsModule, DatePipe],
  templateUrl: './profiles-tab.html',
  styleUrl: './profiles-tab.scss'
})
export class ProfilesTab implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly profileService = inject(ProfileService);
  private readonly guestDocumentService = inject(GuestDocumentService);
  private readonly reservationService = inject(ReservationService);

  readonly profiles = signal<ProfileResponse[]>([]);
  readonly selectedProfileId = signal<number | null>(null);

  readonly selectedProfile = computed(
    () => this.profiles().find(p => p.id === this.selectedProfileId()) ?? null
  );

  readonly history = signal<ProfileReservationResponse[]>([]);

  readonly loading = signal(true);
  readonly savingProfile = signal(false);
  readonly savingDocument = signal(false);
  readonly loadingHistory = signal(false);

  readonly error = signal('');
  readonly success = signal('');

  readonly genderOptions = [
    { value: Gender.MALE, label: 'Чоловіча' },
    { value: Gender.FEMALE, label: 'Жіноча' }
  ];

  readonly documentTypes = [
    { value: DocumentType.PASSPORT, label: 'Паспорт' },
    { value: DocumentType.ID_CARD, label: 'ID-картка' },
    { value: DocumentType.DRIVER_LICENSE, label: 'Водійське посвідчення' },
    { value: DocumentType.RESIDENCE_PERMIT, label: 'Посвідка на проживання' },
    { value: DocumentType.VISA, label: 'Віза' },
    { value: DocumentType.BIRTH_CERTIFICATE, label: 'Свідоцтво про народження' },
    { value: DocumentType.OTHER, label: 'Інший документ' }
  ];

  readonly profileForm = signal<ProfileForm>(this.emptyProfileForm());

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
    const idParam = this.route.snapshot.paramMap.get('id');
    const reservationId = Number(idParam);

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
        const guestIds = new Set<number>([
          ...(reservation.primaryGuest ? [reservation.primaryGuest.id] : []),
          ...(reservation.guestIds ?? [])
        ]);

        const reservationProfiles = allProfiles.filter(
          profile => guestIds.has(profile.id)
        );

        this.profiles.set(reservationProfiles);

        if (reservationProfiles.length > 0) {
          this.selectProfile(reservationProfiles[0]);
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

  getFullName(profile: ProfileResponse): string {
    return [
      profile.lastName,
      profile.firstName,
      profile.middleName
    ].filter(Boolean).join(' ');
  }

  selectProfile(profile: ProfileResponse): void {
    this.selectedProfileId.set(profile.id);
    this.profileForm.set(this.toProfileForm(profile));
    this.history.set([]);
    this.success.set('');
    this.error.set('');

    this.loadHistory(profile.id);
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

  updateProfileField(field: ProfileField, value: string): void {
    this.profileForm.update(form => ({
      ...form,
      [field]: field === 'gender'
        ? (value ? value as Gender : null)
        : value
    }));
  }

  saveProfile(): void {
    const profile = this.selectedProfile();

    if (!profile || this.savingProfile()) {
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
      placeOfBirth: form.placeOfBirth.trim() || null,
      citizenship: form.citizenship.trim() || null,
      taxNumber: form.taxNumber.trim() || null,
      address: form.address.trim() || null,
      registrationAddress: form.registrationAddress.trim() || null
    };

    this.savingProfile.set(true);
    this.error.set('');
    this.success.set('');

    this.profileService.update(profile.id, request).pipe(
      finalize(() => this.savingProfile.set(false))
    ).subscribe({
      next: updated => {
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
      placeOfBirth: profile.placeOfBirth ?? '',
      citizenship: profile.citizenship ?? '',
      taxNumber: profile.taxNumber ?? '',
      address: profile.address ?? '',
      registrationAddress: profile.registrationAddress ?? ''
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
      placeOfBirth: '',
      citizenship: '',
      taxNumber: '',
      address: '',
      registrationAddress: ''
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
