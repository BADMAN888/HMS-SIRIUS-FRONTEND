import { RoomStatus } from '../enums/room-status.enum';
import { HousekeepingTaskStatus } from './housekeeping-task-status.enum';
import { HousekeepingTaskType } from './housekeeping-task-type.enum';

export interface HousekeepingTaskResponse {
  id: number;
  roomId: number;
  roomNumber: string;
  floor: number | null;
  roomStatus: RoomStatus;
  roomClean: boolean;
  departureReservationId: number | null;
  departureGuest: string | null;
  checkOutAt: string | null;
  arrivalReservationId: number | null;
  arrivalGuest: string | null;
  checkInAt: string | null;
  taskType: HousekeepingTaskType;
  status: HousekeepingTaskStatus;
  attendantNumber: number;
  priority: number;
  estimatedMinutes: number;
  notes: string | null;
  completedAt: string | null;
}
