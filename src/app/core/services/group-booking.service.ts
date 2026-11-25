import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GroupBookingCreateRequest, GroupBookingDetails, GroupBookingPage } from '../models/reservation/group-booking.model';

@Injectable({ providedIn: 'root' })
export class GroupBookingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/group-bookings';

  search(query: string, from: string, to: string, page: number, hotelId: number | null): Observable<GroupBookingPage> {
    let params = new HttpParams().set('page', page).set('size', 20);
    if (query.trim()) params = params.set('query', query.trim());
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    if (hotelId !== null) params = params.set('hotelId', hotelId);
    return this.http.get<GroupBookingPage>(`${this.apiUrl}/search`, { params });
  }

  get(id: number): Observable<GroupBookingDetails> {
    return this.http.get<GroupBookingDetails>(`${this.apiUrl}/${id}`);
  }

  create(request: GroupBookingCreateRequest): Observable<GroupBookingDetails> {
    return this.http.post<GroupBookingDetails>(this.apiUrl, request);
  }
}
