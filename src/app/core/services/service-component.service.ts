import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ServiceComponentRequest, ServiceComponentResponse } from '../models/billing/service-component.model';

@Injectable({ providedIn: 'root' })
export class ServiceComponentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/service-components';

  getByRate(rateId: number): Observable<ServiceComponentResponse[]> {
    return this.http.get<ServiceComponentResponse[]>(`${this.apiUrl}/rate/${rateId}`);
  }

  getByFacility(facilityId: number): Observable<ServiceComponentResponse[]> {
    return this.http.get<ServiceComponentResponse[]>(`${this.apiUrl}/facility/${facilityId}`);
  }

  create(request: ServiceComponentRequest): Observable<ServiceComponentResponse> {
    return this.http.post<ServiceComponentResponse>(this.apiUrl, request);
  }

  update(id: number, request: ServiceComponentRequest): Observable<ServiceComponentResponse> {
    return this.http.put<ServiceComponentResponse>(`${this.apiUrl}/${id}`, request);
  }

  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
