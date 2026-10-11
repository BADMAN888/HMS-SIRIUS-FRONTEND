import { RoomStatus } from './room-status.enum';
import { RoomView } from './room-view.enum';

export interface RoomResponse {
  id: number;
  roomNumber: string;
  floor: number | null;
  status: RoomStatus;
  roomView: RoomView;
  hotelId: number | null;
  categoryId: number | null;
}
