
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RoomResponse } from '../models/hotel/room-response.model';
import { RoomRequest } from '../models/hotel/room-request.model';

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/rooms';

  getAll(): Observable<RoomResponse[]> {
    return this.http.get<RoomResponse[]>(this.apiUrl);
  }

  getByHotelId(hotelId: number): Observable<RoomResponse[]> {
    return this.http.get<RoomResponse[]>(
      `${this.apiUrl}/hotel/${hotelId}`
    );
  }

  getById(id: number): Observable<RoomResponse> {
    return this.http.get<RoomResponse>(
      `${this.apiUrl}/${id}`
    );
  }

  create(request: RoomRequest): Observable<RoomResponse> {
    return this.http.post<RoomResponse>(
      this.apiUrl,
      request
    );
  }

  update(id: number, request: RoomRequest): Observable<RoomResponse> {
    return this.http.put<RoomResponse>(
      `${this.apiUrl}/${id}`,
      request
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${id}`
    );
  }
}
