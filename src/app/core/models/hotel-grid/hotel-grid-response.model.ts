import { HotelGridRoomResponse } from './hotel-grid-room-response.model';

export interface HotelGridResponse {
  startDate: string;
  endDate: string;
  rooms: HotelGridRoomResponse[];
}
