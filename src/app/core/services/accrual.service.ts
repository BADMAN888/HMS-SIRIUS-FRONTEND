
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AccrualRequest } from '../models/billing/accrual-request.model';
import { AccrualResponse } from '../models/billing/accrual-response.model';

@Injectable({
  providedIn: 'root'
})
export class AccrualService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/accruals';

  getAll(): Observable<AccrualResponse[]> {
    return this.http.get<AccrualResponse[]>(this.apiUrl);
  }

  getById(id: number): Observable<AccrualResponse> {
    return this.http.get<AccrualResponse>(`${this.apiUrl}/${id}`);
  }

  getByFolioId(folioId: number): Observable<AccrualResponse[]> {
    return this.http.get<AccrualResponse[]>(`${this.apiUrl}/folio/${folioId}`);
  }

  create(request: AccrualRequest): Observable<AccrualResponse> {
    return this.http.post<AccrualResponse>(this.apiUrl, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
