import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { finalize, forkJoin } from 'rxjs';


import { ProfileService } from '../../../../core/services/profile.service';
import { RoomService } from '../../../../core/services/room.service';
import { RateService } from '../../../../core/services/rate.service';
import { RoomCategoryService } from '../../../../core/services/room-category.service';
import { CompanyService } from '../../../../core/services/company.service';

import { ReservationResponse } from '../../../../core/models/reservation/reservation-response.model';
import { ProfileResponse } from '../../../../core/models/profile/profile-response.model';
import { RoomResponse } from '../../../../core/models/hotel/room-response.model';
import { RoomCategoryResponse } from '../../../../core/models/hotel/room-category-response.model';
import { RateResponse } from '../../../../core/models/billing/rate-response.model';
import { ReservationRequest } from '../../../../core/models/reservation/reservation-request.model';
import { ReservationCommentResponse } from '../../../../core/models/reservation/reservation-comment-response.model';
import {CompanyResponse} from '../../../../core/models/company-response.model';
import {ReservationService} from '../../../../core/services/reservation.service';


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
  ],
  templateUrl: './reservation-tab.html',
  styleUrl: './reservation-tab.scss'
})
export class ReservationTab implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);

  private readonly reservationService = inject(ReservationService);
  private readonly profileService = inject(ProfileService);
  private readonly roomService = inject(RoomService);
  private readonly rateService = inject(RateService);
  private readonly roomCategoryService = inject(RoomCategoryService);
  private readonly companyService = inject(CompanyService);

  readonly reservation = signal<ReservationResponse | null>(null);

  readonly profiles = signal<ProfileResponse[]>([]);
  readonly rooms = signal<RoomResponse[]>([]);
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
  readonly editRateId = signal(0);
  readonly editPrimaryGuestId = signal(0);
  readonly editGuestIds = signal<number[]>([]);
  readonly editCheckIn = signal('');
  readonly editCheckOut = signal('');
  readonly editAdults = signal(1);
  readonly editChildren = signal(0);

  readonly editSourceCompanyId = signal<number | null>(null);
  readonly editOperatorCompanyId = signal<number | null>(null);
  readonly editBookingSource = signal('');
  readonly editExternalBookingNumber = signal('');

  readonly reservationNumberCopied = signal(false);

  readonly filteredRooms = computed(() => {
    const categoryId = this.editRoomCategoryId();
    const currentRoomId = this.editRoomId();

    if (!categoryId) {
      return this.rooms();
    }

    return this.rooms().filter(
      room =>
        room.categoryId === categoryId ||
        room.id === currentRoomId
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

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!id) {
      this.error.set('Некоректний ID бронювання.');
      this.loading.set(false);
      this.loadingEditData.set(false);
      return;
    }

    this.loadDataAndReservation(id);
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
  }

  onGuestPhoneSearch(value: string): void {
    this.guestPhoneSearch.set(value);
    this.resetSelectedGuest();
  }

  onGuestEmailSearch(value: string): void {
    this.guestEmailSearch.set(value);
    this.resetSelectedGuest();
  }

  private resetSelectedGuest(): void {
    this.selectedGuest.set(null);
    this.editPrimaryGuestId.set(0);
  }

  selectPrimaryGuest(profile: ProfileResponse): void {
    this.selectedGuest.set(profile);
    this.editPrimaryGuestId.set(profile.id);
    this.guestSearch.set(this.getProfileFullName(profile));
    this.guestPhoneSearch.set(profile.phoneNumber ?? '');
    this.guestEmailSearch.set(profile.email ?? '');
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
      allRooms: this.roomService.getAll()
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

        this.reservation.set(data.reservation);
        this.initializeForm(data.reservation);
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

    this.editSourceCompanyId.set(reservation.sourceCompany?.id ?? null);
    this.editOperatorCompanyId.set(reservation.operatorCompany?.id ?? null);
    this.editBookingSource.set(reservation.bookingSource ?? '');
    this.editExternalBookingNumber.set(
      reservation.externalBookingNumber ?? ''
    );

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

  onRoomCategoryChange(categoryId: number | null): void {
    if (categoryId === null || this.editRoomCategoryId() === categoryId) {
      return;
    }

    this.editRoomCategoryId.set(categoryId);
    this.editRoomId.set(0);
    this.saveError.set('');
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

  save(): void {
    const reservation = this.reservation();

    if (!reservation || this.saving()) {
      return;
    }

    if (this.loadingEditData()) {
      this.saveError.set('Зачекайте, поки завантажаться дані форми.');
      return;
    }

    const missingFields: string[] = [];

    if (!this.editPrimaryGuestId()) {
      missingFields.push('основного гостя');
    }

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

    const checkInTime = new Date(this.editCheckIn()).getTime();
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
      this.editPrimaryGuestId()
    ]));

    const request: ReservationRequest = {
      roomId: this.editRoomId(),
      rateId: this.editRateId(),
      paymentCategoryId: this.editPaymentCategoryId(),
      primaryGuestId: this.editPrimaryGuestId(),
      guestIds,
      checkIn: this.toLocalDateTime(this.editCheckIn()),
      checkOut: this.toLocalDateTime(this.editCheckOut()),
      adults: this.editAdults(),
      children: this.editChildren(),
      bookingSource: this.editBookingSource().trim() || null,
      sourceCompanyId: this.editSourceCompanyId(),
      operatorCompanyId: this.editOperatorCompanyId(),
      externalBookingNumber:
        this.editExternalBookingNumber().trim() || null
    };

    this.reservationService.update(reservation.id, request).pipe(
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: updatedReservation => {
        this.reservation.set(updatedReservation);
        this.initializeForm(updatedReservation);
        this.saved.set(true);
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

  cancelReservation(): void {
    this.runLifecycleAction('cancel');
  }

  markNoShow(): void {
    this.runLifecycleAction('no-show');
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
    this.editGuestIds.update(ids => ids.filter(id => id !== profileId));
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
            error?.error?.message || 'Не вдалося завантажити коментарі.'
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
            error?.error?.message || 'Не вдалося додати коментар.'
          );
        }
      });
  }

  deleteSelectedComment(): void {
    const reservation = this.reservation();
    const commentId = this.selectedCommentId();

    if (!reservation || commentId === null || this.commentBusy()) {
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
            error?.error?.message || 'Не вдалося видалити коментар.'
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
  readonly filteredRates = computed(() => {
    const categoryId = this.editPaymentCategoryId();

    return this.rates().filter(rate => rate.categoryId === categoryId);
  });
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
