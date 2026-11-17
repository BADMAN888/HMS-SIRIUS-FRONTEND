import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { LegalEntityRequest } from '../models/legal-entity-request.model';
import { LegalEntityResponse } from '../models/legal-entity-response.model';

@Injectable({ providedIn: 'root' })
export class LegalEntityService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/legal-entities';

  getByHotelId(hotelId: number): Observable<LegalEntityResponse[]> {
    return this.http.get<LegalEntityResponse[]>(`${this.apiUrl}/hotel/${hotelId}`);
  }

  getAll(): Observable<LegalEntityResponse[]> {
    return this.http.get<LegalEntityResponse[]>(this.apiUrl);
  }

  getById(id: number): Observable<LegalEntityResponse> {
    return this.http.get<LegalEntityResponse>(`${this.apiUrl}/${id}`);
  }

  create(request: LegalEntityRequest): Observable<LegalEntityResponse> {
    return this.http.post<LegalEntityResponse>(this.apiUrl, request);
  }

  update(id: number, request: LegalEntityRequest): Observable<LegalEntityResponse> {
    return this.http.put<LegalEntityResponse>(`${this.apiUrl}/${id}`, request);
  }

  deactivate(id: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/deactivate`, null);
  }

  activate(id: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/activate`, null);
  }
}
