import { RoomStatus } from '../hotel/room-status.enum';
import { RoomView } from '../hotel/room-view.enum';
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
