import { RoomResponse } from '../hotel/room-response.model';
import { RateResponse } from '../billing/rate-response.model';
import { ProfileResponse } from '../profile/profile-response.model';
import { ReservationCommentResponse } from './reservation-comment-response.model';
import {ReservationStatus} from '../enums/reservation-status.enum';

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
}
