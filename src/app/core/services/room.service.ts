
import {HttpClient, HttpParams} from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RoomRequest } from '../models/hotel/room-request.model';
import { RoomResponse } from '../models/hotel/room-response.model';
import {RoomStatus} from '../models/enums/room-status.enum';


@Injectable({
  providedIn: 'root'
})
export class RoomService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/rooms';

  getById(id: number): Observable<RoomResponse> {
    return this.http.get<RoomResponse>(`${this.apiUrl}/${id}`);
  }

  getAll(): Observable<RoomResponse[]> {
    return this.http.get<RoomResponse[]>(this.apiUrl);
  }

  getAllByHotelId(hotelId: number): Observable<RoomResponse[]> {
    return this.http.get<RoomResponse[]>(
      `${this.apiUrl}/hotel/${hotelId}`
    );
  }

  getAllByCategoryId(categoryId: number): Observable<RoomResponse[]> {
    return this.http.get<RoomResponse[]>(
      `${this.apiUrl}/category/${categoryId}`
    );
  }

  getAllByStatus(
    hotelId: number,
    status: RoomStatus
  ): Observable<RoomResponse[]> {
    return this.http.get<RoomResponse[]>(
      `${this.apiUrl}/hotel/${hotelId}/status/${status}`
    );
  }

  create(request: RoomRequest): Observable<RoomResponse> {
    return this.http.post<RoomResponse>(this.apiUrl, request);
  }

  update(id: number, request: RoomRequest): Observable<RoomResponse> {
    return this.http.put<RoomResponse>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/${id}`, {
      responseType: 'text'
    });
  }
  getAllByCategoryIdAndStatus(
    categoryId: number,
    status: RoomStatus
  ): Observable<RoomResponse[]> {
    return this.http.get<RoomResponse[]>(
      `${this.apiUrl}/category/${categoryId}/status/${status}`
    );
  }
}
