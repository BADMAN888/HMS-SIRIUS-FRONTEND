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
  bookingSource?: string | null;
  sourceCompanyId?: number | null;
  operatorCompanyId?: number | null;
  externalBookingNumber?: string | null;
}
