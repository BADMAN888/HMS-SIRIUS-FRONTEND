import { HousekeepingTaskResponse } from './housekeeping-task-response.model';

export interface HousekeepingPlanResponse {
  id: number;
  hotelId: number;
  serviceDate: string;
  attendantCount: number;
  updatedAt: string;
  tasks: HousekeepingTaskResponse[];
}
