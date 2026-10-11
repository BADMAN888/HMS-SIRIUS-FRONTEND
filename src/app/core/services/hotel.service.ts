import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { HotelRequest } from '../models/hotel/hotel-request.model';
import {HotelResponse} from '../models/hotel/hotel-response.model';

@Injectable({
  providedIn: 'root'
})
export class HotelService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/hotels';

  getAll(): Observable<HotelResponse[]> {
    return this.http.get<HotelResponse[]>(this.apiUrl);
  }

  getById(id: number): Observable<HotelResponse> {
    return this.http.get<HotelResponse>(
      `${this.apiUrl}/${id}`
    );
  }

  create(request: HotelRequest): Observable<HotelResponse> {
    return this.http.post<HotelResponse>(
      this.apiUrl,
      request
    );
  }

  update(id: number, request: HotelRequest): Observable<HotelResponse> {
    return this.http.put<HotelResponse>(
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
