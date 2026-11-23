import { TaxStatus } from '../enums/tax-status.enum';

export interface ReservationRequest {
  roomId: number;
  rateId: number;
  paymentCategoryId: number;
  primaryGuestId: number | null;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  roomLocked: boolean;
  guestIds: number[];
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  taxStatus?: TaxStatus | null;
  externalBookingNumber?: string | null;
  bookingSource?: string | null;
  sourceCompanyId?: number | null;
  operatorCompanyId?: number | null;
  earlyCheckInAccepted?: boolean;
  lateCheckOutAccepted?: boolean;
  earlyExtraNightAccepted?: boolean;
  lateExtraNightAccepted?: boolean;
}
