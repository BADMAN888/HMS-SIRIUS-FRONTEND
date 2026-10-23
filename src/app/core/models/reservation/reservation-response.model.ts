
import { RateResponse } from '../billing/rate-response.model';
import { RoomResponse } from '../hotel/room-response.model';
import { ReservationStatus } from '../enums/reservation-status.enum';
import { ProfileResponse } from '../profile/profile-response.model';
import { ReservationCommentResponse } from './reservation-comment-response.model';

export interface ReservationResponse {
  id: number;
  confirmationNumber: string;
  room: RoomResponse;
  rate: RateResponse;
  primaryGuest: ProfileResponse;
  guestIds: number[];
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  status: ReservationStatus;
  comments: ReservationCommentResponse[];
  createdAt: string;
  folioId: number | null;
  externalBookingNumber: string | null;
  bookingSource: string | null;
  company: string | null;
  operatorCompany: string | null;
}
