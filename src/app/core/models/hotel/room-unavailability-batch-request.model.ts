import { RoomUnavailabilityStatus } from '../enums/room-unavailability-status.enum';

export interface RoomUnavailabilityBatchRequest {
  hotelId: number;
  roomIds: number[];
  status: RoomUnavailabilityStatus;
  startAt: string;
  endAt: string;
  reason: string;
}
