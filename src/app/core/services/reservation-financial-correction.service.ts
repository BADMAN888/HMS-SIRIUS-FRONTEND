import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ReservationFinancialCorrectionRequest } from '../models/reservation/reservation-financial-correction-request.model';
import { ReservationFinancialCorrectionResponse } from '../models/reservation/reservation-financial-correction-response.model';

@Injectable({
  providedIn: 'root'
})
export class ReservationFinancialCorrectionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/reservation-financial-corrections';

  correct(
    request: ReservationFinancialCorrectionRequest
  ): Observable<ReservationFinancialCorrectionResponse> {
    return this.http.post<ReservationFinancialCorrectionResponse>(
      this.apiUrl,
      request
    );
  }
}
