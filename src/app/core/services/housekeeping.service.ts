import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HousekeepingPlanGenerateRequest } from '../models/housekeeping/housekeeping-plan-generate-request.model';
import { HousekeepingPlanResponse } from '../models/housekeeping/housekeeping-plan-response.model';
import { HousekeepingTaskResponse } from '../models/housekeeping/housekeeping-task-response.model';
import { HousekeepingTaskUpdateRequest } from '../models/housekeeping/housekeeping-task-update-request.model';

@Injectable({ providedIn: 'root' })
export class HousekeepingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/housekeeping';

  getPlan(hotelId: number, date: string): Observable<HousekeepingPlanResponse> {
    const params = new HttpParams().set('hotelId', hotelId).set('date', date);
    return this.http.get<HousekeepingPlanResponse>(`${this.apiUrl}/plans`, { params });
  }

  generate(request: HousekeepingPlanGenerateRequest): Observable<HousekeepingPlanResponse> {
    return this.http.post<HousekeepingPlanResponse>(`${this.apiUrl}/plans/generate`, request);
  }

  updateTask(taskId: number, request: HousekeepingTaskUpdateRequest): Observable<HousekeepingTaskResponse> {
    return this.http.patch<HousekeepingTaskResponse>(`${this.apiUrl}/tasks/${taskId}`, request);
  }
}
