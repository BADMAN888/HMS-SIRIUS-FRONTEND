import { RoomStatus } from '../enums/room-status.enum';
import { RoomView } from '../enums/room-view.enum';
import { HotelGridReservationResponse } from './hotel-grid-reservation-response.model';

export interface HotelGridRoomResponse {
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
