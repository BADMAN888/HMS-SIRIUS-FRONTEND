import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ReservationRequest } from '../models/reservation/reservation-request.model';
import { ReservationResponse } from '../models/reservation/reservation-response.model';
import {ReservationStatus} from '../models/enums/reservation-status.enum';


@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/reservations';

  getAll(): Observable<ReservationResponse[]> {
    return this.http.get<ReservationResponse[]>(this.apiUrl);
  }

  getById(id: number): Observable<ReservationResponse> {
    return this.http.get<ReservationResponse>(`${this.apiUrl}/${id}`);
  }

  create(request: ReservationRequest): Observable<ReservationResponse> {
    return this.http.post<ReservationResponse>(this.apiUrl, request);
  }

  update(
    id: number,
    request: ReservationRequest
  ): Observable<ReservationResponse> {
    return this.http.put<ReservationResponse>(
      `${this.apiUrl}/${id}`,
      request
    );
  }

  cancel(id: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/cancel`, {});
  }

  noShow(id: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/no-show`, {});
  }

  checkIn(id: number): Observable<unknown> {
    return this.http.post<unknown>(
      `${this.apiUrl}/${id}/check-in`,
      {}
    );
  }

  checkOut(id: number): Observable<unknown> {
    return this.http.post<unknown>(
      `${this.apiUrl}/${id}/check-out`,
      {}
    );
  }

  getByStatus(status: ReservationStatus): Observable<ReservationResponse[]> {
    const params = new HttpParams().set('status', status);

    return this.http.get<ReservationResponse[]>(this.apiUrl, { params });
  }
}
