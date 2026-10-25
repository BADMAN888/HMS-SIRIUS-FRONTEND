import { RoomUnavailabilityStatus } from '../enums/room-unavailability-status.enum';

export interface RoomUnavailabilityResponse {
  id: number;
  roomId: number;
  roomNumber: string;
  status: RoomUnavailabilityStatus;
  startAt: string;
  endAt: string;
  reason: string;
  createdAt: string;
  completedAt: string | null;
}
