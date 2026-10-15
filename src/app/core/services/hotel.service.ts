
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HotelRequest } from '../models/hotel/hotel-request.model';
import { HotelResponse } from '../models/hotel/hotel-response.model';

@Injectable({
  providedIn: 'root'
})
export class HotelService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/hotels';

  getHotelById(id: number): Observable<HotelResponse> {
    return this.http.get<HotelResponse>(`${this.apiUrl}/${id}`);
  }

  getHotelByName(name: string): Observable<HotelResponse> {
    const params = new HttpParams().set('name', name);

    return this.http.get<HotelResponse>(`${this.apiUrl}/by-name`, {
      params
    });
  }

  createHotel(request: HotelRequest): Observable<HotelResponse> {
    return this.http.post<HotelResponse>(this.apiUrl, request);
  }

  updateHotel(id: number, request: HotelRequest): Observable<HotelResponse> {
    return this.http.put<HotelResponse>(`${this.apiUrl}/${id}`, request);
  }

  deleteHotel(id: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/${id}`, {
      responseType: 'text'
    });
  }
}
