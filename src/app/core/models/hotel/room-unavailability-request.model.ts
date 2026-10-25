import { RoomUnavailabilityStatus } from '../enums/room-unavailability-status.enum';

export interface RoomUnavailabilityRequest {
  roomId: number;
  status: RoomUnavailabilityStatus;
  startAt: string;
  endAt: string;
  reason: string;
}
