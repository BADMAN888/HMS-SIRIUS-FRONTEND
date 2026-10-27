export interface ReservationRequest {
  roomId: number;
  rateId: number;
  paymentCategoryId: number;
  primaryGuestId: number;
  guestIds: number[];
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  externalBookingNumber?: string | null;
  bookingSource?: string | null;
  sourceCompanyId?: number | null;
  operatorCompanyId?: number | null;
}
