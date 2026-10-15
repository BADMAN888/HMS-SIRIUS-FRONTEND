
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PriceRequest } from '../models/billing/price-request.model';
import { PriceResponse } from '../models/billing/price-response.model';

@Injectable({
  providedIn: 'root'
})
export class PriceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/prices';

  create(request: PriceRequest): Observable<PriceResponse> {
    return this.http.post<PriceResponse>(this.apiUrl, request);
  }

  getById(id: number): Observable<PriceResponse> {
    return this.http.get<PriceResponse>(`${this.apiUrl}/${id}`);
  }

  getAll(): Observable<PriceResponse[]> {
    return this.http.get<PriceResponse[]>(this.apiUrl);
  }

  update(id: number, request: PriceRequest): Observable<PriceResponse> {
    return this.http.put<PriceResponse>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
