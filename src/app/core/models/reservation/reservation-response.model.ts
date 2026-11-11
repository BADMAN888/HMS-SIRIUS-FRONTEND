import { RateResponse } from '../billing/rate-response.model';
import { RoomResponse } from '../hotel/room-response.model';
import { ReservationStatus } from '../enums/reservation-status.enum';
import { TaxStatus } from '../enums/tax-status.enum';
import { ProfileResponse } from '../profile/profile-response.model';
import { ReservationCommentResponse } from './reservation-comment-response.model';
import { CompanyResponse } from '../company-response.model';

export interface ReservationResponse {
  id: number;
  confirmationNumber: string;
  room: RoomResponse;
  rate: RateResponse;
  paymentCategoryId: number;
  paymentCategoryName: string;
  primaryGuest: ProfileResponse;
  guestIds: number[];
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  taxStatus: TaxStatus;
  status: ReservationStatus;
  comments: ReservationCommentResponse[];
  createdAt: string;
  folioId: number | null;
  externalBookingNumber: string | null;
  bookingSource: string | null;
  sourceCompany: CompanyResponse | null;
  operatorCompany: CompanyResponse | null;
}
