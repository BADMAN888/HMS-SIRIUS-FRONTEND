
import { ReservationCommentResponse } from './reservation-comment-response.model';
import {ReservationStatus} from '../enums/reservation-status.enum';

export interface ReservationCheckOutResponse {
  id: number;
  confirmationNumber: string;
  roomId: number;
  guestFirstName: string;
  guestLastName: string;
  guestMiddleName: string | null;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  comments: ReservationCommentResponse[];
  totalAmount: number;
}
