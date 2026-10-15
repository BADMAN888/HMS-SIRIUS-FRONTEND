
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FolioRequest } from '../models/billing/folio-request.model';
import { FolioResponse } from '../models/billing/folio-response.model';

@Injectable({
  providedIn: 'root'
})
export class FolioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/folios';

  create(request: FolioRequest): Observable<FolioResponse> {
    return this.http.post<FolioResponse>(this.apiUrl, request);
  }

  getById(id: number): Observable<FolioResponse> {
    return this.http.get<FolioResponse>(`${this.apiUrl}/${id}`);
  }

  getByReservationId(reservationId: number): Observable<FolioResponse> {
    return this.http.get<FolioResponse>(
      `${this.apiUrl}/reservation/${reservationId}`
    );
  }

  getAll(): Observable<FolioResponse[]> {
    return this.http.get<FolioResponse[]>(this.apiUrl);
  }

  update(id: number, request: FolioRequest): Observable<FolioResponse> {
    return this.http.put<FolioResponse>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
