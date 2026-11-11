import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { FacilityRequest } from '../models/billing/facility-request.model';
import { FacilityResponse } from '../models/billing/facility-response.model';

@Injectable({
  providedIn: 'root'
})
export class FacilityService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/facilities';

  create(request: FacilityRequest): Observable<FacilityResponse> {
    return this.http.post<FacilityResponse>(this.apiUrl, request);
  }

  getById(id: number): Observable<FacilityResponse> {
    return this.http.get<FacilityResponse>(`${this.apiUrl}/${id}`);
  }

  getAllByHotelId(hotelId: number): Observable<FacilityResponse[]> {
    return this.http.get<FacilityResponse[]>(
      `${this.apiUrl}/hotel/${hotelId}`
    );
  }

  getActiveByHotelId(hotelId: number): Observable<FacilityResponse[]> {
    return this.http.get<FacilityResponse[]>(
      `${this.apiUrl}/hotel/${hotelId}/active`
    );
  }

  update(
    id: number,
    request: FacilityRequest
  ): Observable<FacilityResponse> {
    return this.http.put<FacilityResponse>(
      `${this.apiUrl}/${id}`,
      request
    );
  }

  deactivate(id: number): Observable<void> {
    return this.http.patch<void>(
      `${this.apiUrl}/${id}/deactivate`,
      null
    );
  }
}
