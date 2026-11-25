import { ReservationResponse } from './reservation-response.model';

export interface GroupBookingRoomRequest {
  roomId: number;
  rateId: number;
  paymentCategoryId: number;
  primaryGuestId: number | null;
  guestIds: number[];
  adults: number;
  children: number;
  roomLocked: boolean;
  guestName: string;
}

export interface GroupBookingCreateRequest {
  hotelId: number;
  groupName: string;
  organizerName: string;
  contactPhone: string;
  contactEmail: string | null;
  checkIn: string;
  checkOut: string;
  notes: string;
  externalBookingNumber: string;
  bookingSource: string;
  taxStatus: 'RESIDENT';
  reservations: GroupBookingRoomRequest[];
}

export interface GroupBookingSummary {
  id: number;
  reference: string;
  groupName: string;
  organizerName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  checkIn: string;
  checkOut: string;
  status: 'CONFIRMED' | 'IN_HOUSE' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED';
  reservationCount: number;
  guestCount: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
}

export interface GroupBookingReservation {
  reservation: ReservationResponse;
  totalAmount: number;
  paidAmount: number;
  balance: number;
}

export interface GroupBookingDetails {
  group: GroupBookingSummary;
  notes: string | null;
  reservations: GroupBookingReservation[];
}

export interface GroupBookingPage {
  content: GroupBookingSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
