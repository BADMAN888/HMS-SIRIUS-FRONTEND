
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PaymentRequest } from '../models/billing/payment-request.model';
import { PaymentResponse } from '../models/billing/payment-response.model';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/payments';

  create(request: PaymentRequest): Observable<PaymentResponse> {
    return this.http.post<PaymentResponse>(this.apiUrl, request);
  }

  getById(id: number): Observable<PaymentResponse> {
    return this.http.get<PaymentResponse>(`${this.apiUrl}/${id}`);
  }

  getAll(): Observable<PaymentResponse[]> {
    return this.http.get<PaymentResponse[]>(this.apiUrl);
  }

  getByFolioId(folioId: number): Observable<PaymentResponse[]> {
    return this.http.get<PaymentResponse[]>(
      `${this.apiUrl}/folio/${folioId}`
    );
  }

  update(id: number, request: PaymentRequest): Observable<PaymentResponse> {
    return this.http.put<PaymentResponse>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
