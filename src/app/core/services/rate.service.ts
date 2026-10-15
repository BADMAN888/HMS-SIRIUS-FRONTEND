
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RateRequest } from '../models/billing/rate-request.model';
import { RateResponse } from '../models/billing/rate-response.model';

@Injectable({
  providedIn: 'root'
})
export class RateService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/rates';

  create(request: RateRequest): Observable<RateResponse> {
    return this.http.post<RateResponse>(this.apiUrl, request);
  }

  getById(id: number): Observable<RateResponse> {
    return this.http.get<RateResponse>(`${this.apiUrl}/${id}`);
  }

  getAll(): Observable<RateResponse[]> {
    return this.http.get<RateResponse[]>(this.apiUrl);
  }

  update(id: number, request: RateRequest): Observable<RateResponse> {
    return this.http.put<RateResponse>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
