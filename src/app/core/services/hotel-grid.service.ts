
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {HotelGridResponse} from '../models/hotel-grid/hotel-grid-response.model';


@Injectable({
  providedIn: 'root'
})
export class HotelGridService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/hotel-grid';

  getGrid(startDate: string, endDate: string): Observable<HotelGridResponse> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.get<HotelGridResponse>(this.apiUrl, { params });
  }
}
