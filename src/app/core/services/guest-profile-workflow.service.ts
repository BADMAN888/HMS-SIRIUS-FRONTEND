import { Injectable, signal } from '@angular/core';

import { ProfileResponse } from '../models/profile/profile-response.model';

export type GuestProfileTarget = 'primary' | 'additional';

export interface GuestProfileDraftIntent {
  requestId: number;
  target: GuestProfileTarget;
  returnToReservation: boolean;
  firstName: string;
  lastName: string;
  middleName: string;
  phoneNumber: string;
  email: string;
}

export interface CreatedGuestProfileEvent {
  requestId: number;
  target: GuestProfileTarget;
  returnToReservation: boolean;
  profile: ProfileResponse;
}

@Injectable({ providedIn: 'root' })
export class GuestProfileWorkflowService {
  readonly pendingDraft = signal<GuestProfileDraftIntent | null>(null);
  readonly createdProfile = signal<CreatedGuestProfileEvent | null>(null);
  readonly removedDraftProfile = signal<{ profileId: number; eventId: number } | null>(null);
  readonly reservationGuests = signal<{
    primaryGuestId: number;
    guestIds: number[];
    eventId: number;
  } | null>(null);

  private requestId = 0;
  private removalEventId = 0;
  private guestListEventId = 0;

  start(
    intent: Omit<GuestProfileDraftIntent, 'requestId' | 'returnToReservation'> & {
      returnToReservation?: boolean;
    }
  ): void {
    this.createdProfile.set(null);
    this.pendingDraft.set({
      ...intent,
      returnToReservation: intent.returnToReservation ?? true,
      requestId: ++this.requestId
    });
  }

  complete(profile: ProfileResponse, requestId: number): void {
    const intent = this.pendingDraft();

    if (!intent || intent.requestId !== requestId) {
      return;
    }

    this.createdProfile.set({
      requestId,
      target: intent.target,
      returnToReservation: intent.returnToReservation,
      profile
    });
    this.pendingDraft.set(null);
  }

  cancel(requestId: number): void {
    if (this.pendingDraft()?.requestId === requestId) {
      this.pendingDraft.set(null);
    }
  }

  removeFromDraft(profileId: number): void {
    this.removedDraftProfile.set({ profileId, eventId: ++this.removalEventId });
  }

  syncReservationGuests(primaryGuestId: number, guestIds: number[]): void {
    this.reservationGuests.set({
      primaryGuestId,
      guestIds,
      eventId: ++this.guestListEventId
    });
  }
}
