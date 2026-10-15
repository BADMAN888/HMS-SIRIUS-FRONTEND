import { RoomStatus } from '../enums/room-status.enum';
import { RoomView } from '../enums/room-view.enum';

export interface RoomResponse {
  id: number;
  roomNumber: string;
  floor: number | null;
  status: RoomStatus;
  roomView: RoomView;
  hotelId: number | null;
  categoryId: number | null;
}
