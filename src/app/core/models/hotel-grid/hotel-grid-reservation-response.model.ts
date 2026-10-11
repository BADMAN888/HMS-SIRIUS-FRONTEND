import {ReservationStatus} from '../enums/reservation-status.enum';


export interface HotelGridReservationResponse {
  id: number;
  confirmationNumber: string;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  guestFirstName: string;
  guestLastName: string;
  guestPhone: string;
}
