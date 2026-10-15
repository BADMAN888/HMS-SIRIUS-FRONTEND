import { RoomStatus } from '../enums/room-status.enum';
import { RoomView } from '../enums/room-view.enum';

export interface RoomRequest {
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  roomView: RoomView;
  hotelId: number;
  categoryId: number;
}
