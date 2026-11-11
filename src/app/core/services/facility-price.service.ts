import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { FacilityPriceRequest } from '../models/billing/facility-price-request.model';
import { FacilityPriceResponse } from '../models/billing/facility-price-response.model';

@Injectable({
  providedIn: 'root'
})
export class FacilityPriceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/facility-prices';

  create(request: FacilityPriceRequest): Observable<FacilityPriceResponse> {
    return this.http.post<FacilityPriceResponse>(
      this.apiUrl,
      request
    );
  }

  getHistory(facilityId: number): Observable<FacilityPriceResponse[]> {
    return this.http.get<FacilityPriceResponse[]>(
      `${this.apiUrl}/facility/${facilityId}`
    );
  }

  getPriceForDate(
    facilityId: number,
    date: string
  ): Observable<FacilityPriceResponse> {
    return this.http.get<FacilityPriceResponse>(
      `${this.apiUrl}/facility/${facilityId}/date/${date}`
    );
  }
}
