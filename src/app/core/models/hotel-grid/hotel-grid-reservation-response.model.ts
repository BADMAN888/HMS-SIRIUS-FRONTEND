import {ReservationStatus} from '../enums/reservation-status.enum';


export interface HotelGridReservationResponse {
  id: number;
  confirmationNumber: string;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  roomLocked: boolean;
  guestFirstName: string | null;
  guestLastName: string | null;
  guestPhone: string | null;
}
