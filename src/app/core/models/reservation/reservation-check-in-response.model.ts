import {ReservationStatus} from '../enums/reservation-status.enum';
import {ReservationCommentResponse} from './reservation-comment-response.model';


export interface ReservationCheckInResponse {
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
