import { HousekeepingTaskStatus } from './housekeeping-task-status.enum';

export interface HousekeepingTaskUpdateRequest {
  attendantNumber: number;
  status: HousekeepingTaskStatus;
  notes: string | null;
}
