import { RateResponse } from '../billing/rate-response.model';
import { RoomResponse } from '../hotel/room-response.model';
import { Profile } from './profile.model';
import { ReservationComment } from './reservation-comment.model';
import { ReservationStatus } from '../enums/reservation-status.enum';

export interface ReservationResponse {
  id: number;
  confirmationNumber: string;
  room: RoomResponse;
  rate: RateResponse;
  primaryGuest: Profile;
  guestIds: number[];
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  status: ReservationStatus;
  comments: ReservationComment[];
  createdAt: string;
  folioId: number | null;
  externalBookingNumber: string | null;
  bookingSource: string | null;
  company: string | null;
  operatorCompany: string | null;
}
