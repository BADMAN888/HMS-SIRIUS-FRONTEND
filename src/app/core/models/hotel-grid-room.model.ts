import { HotelGridReservationResponse } from './hotel-grid/hotel-grid-reservation-response.model';
import { RoomView } from './enums/room-view.enum';
import { RoomStatus } from './enums/room-status.enum';

export interface HotelGridRoom {
  id: number;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  roomView: RoomView;
  hotelId: number;
  hotelName: string;
  categoryId: number;
  categoryName: string;
  reservations: HotelGridReservationResponse[];
}
