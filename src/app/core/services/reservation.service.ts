import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Reservation } from '../models/reservation/reservation.model';
import { ReservationRequest } from '../models/reservation/reservation-request.model';
import { ReservationStatus } from '../models/enums/reservation-status.enum';
import { ReservationCheckInResponse } from '../models/reservation/reservation-check-in-response.model';
import { ReservationCheckOutResponse } from '../models/reservation/reservation-check-out-response.model';
import { ReservationComment } from '../models/reservation/reservation-comment.model';
import { ReservationCommentResponse } from '../models/reservation/reservation-comment-response.model';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/reservations';

  create(request: ReservationRequest): Observable<Reservation> {
    return this.http.post<Reservation>(this.apiUrl, request);
  }

  getAll(): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(this.apiUrl);
  }

  getById(id: number): Observable<Reservation> {
    return this.http.get<Reservation>(`${this.apiUrl}/${id}`);
  }

  getByStatus(status: ReservationStatus): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(
      `${this.apiUrl}/status/${status}`
    );
  }

  update(
    id: number,
    request: ReservationRequest
  ): Observable<Reservation> {
    return this.http.put<Reservation>(
      `${this.apiUrl}/${id}`,
      request
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  cancel(id: number): Observable<void> {
    return this.http.patch<void>(
      `${this.apiUrl}/${id}/cancel`,
      {}
    );
  }

  checkIn(id: number): Observable<void> {
    return this.http.patch<void>(
      `${this.apiUrl}/${id}/check-in`,
      {}
    );
  }

  checkOut(id: number): Observable<void> {
    return this.http.patch<void>(
      `${this.apiUrl}/${id}/check-out`,
      {}
    );
  }

  noShow(id: number): Observable<void> {
    return this.http.patch<void>(
      `${this.apiUrl}/${id}/no-show`,
      {}
    );
  }

  getByCheckInDate(date: string): Observable<ReservationCheckInResponse[]> {
    const params = new HttpParams().set('date', date);

    return this.http.get<ReservationCheckInResponse[]>(
      `${this.apiUrl}/check-in`,
      { params }
    );
  }

  getByCheckOutDate(date: string): Observable<ReservationCheckOutResponse[]> {
    const params = new HttpParams().set('date', date);

    return this.http.get<ReservationCheckOutResponse[]>(
      `${this.apiUrl}/check-out`,
      { params }
    );
  }

  getByDate(date: string): Observable<Reservation[]> {
    const params = new HttpParams().set('date', date);

    return this.http.get<Reservation[]>(
      `${this.apiUrl}/date`,
      { params }
    );
  }

  getByDateRange(
    startDate: string,
    endDate: string
  ): Observable<Reservation[]> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.get<Reservation[]>(
      `${this.apiUrl}/date-range`,
      { params }
    );
  }

  getComments(id: number): Observable<ReservationCommentResponse[]> {
    return this.http.get<ReservationCommentResponse[]>(
      `${this.apiUrl}/${id}/comments`
    );
  }

  createComment(
    id: number,
    request: ReservationComment
  ): Observable<ReservationCommentResponse> {
    return this.http.post<ReservationCommentResponse>(
      `${this.apiUrl}/${id}/comments`,
      request
    );
  }

  updateComment(
    id: number,
    commentId: number,
    request: ReservationComment
  ): Observable<ReservationCommentResponse> {
    return this.http.put<ReservationCommentResponse>(
      `${this.apiUrl}/${id}/comments/${commentId}`,
      request
    );
  }

  deleteComment(
    id: number,
    commentId: number
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${id}/comments/${commentId}`
    );
  }
}
