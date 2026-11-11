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

  getHistory(rateId: number): Observable<PriceResponse[]> {
    return this.http.get<PriceResponse[]>(
      `${this.apiUrl}/rate/${rateId}`
    );
  }

  getPriceForDate(
    rateId: number,
    date: string
  ): Observable<PriceResponse> {
    return this.http.get<PriceResponse>(
      `${this.apiUrl}/rate/${rateId}/date/${date}`
    );
  }
}
