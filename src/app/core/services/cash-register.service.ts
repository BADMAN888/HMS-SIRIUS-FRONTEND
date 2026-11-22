import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CashLegalEntityTotals, CashOperation, CashRegister, CashRegisterReport, CashShift } from '../models/billing/cash-register.model';

@Injectable({ providedIn: 'root' })
export class CashRegisterService {
  private readonly http = inject(HttpClient);
  private readonly base = 'http://localhost:8080/api/cash-registers';

  list(hotelId: number): Observable<CashRegister[]> { return this.http.get<CashRegister[]>(this.base, { params: { hotelId } }); }
  create(hotelId: number, legalEntityId: number, name: string): Observable<CashRegister> {
    return this.http.post<CashRegister>(this.base, { hotelId, legalEntityId, name, currency: 'UAH' });
  }
  currentShift(registerId: number): Observable<CashShift | null> { return this.http.get<CashShift | null>(`${this.base}/${registerId}/current-shift`); }
  openShift(registerId: number, openingBalance: number): Observable<CashShift> { return this.http.post<CashShift>(`${this.base}/${registerId}/shifts/open`, { openingBalance }); }
  operations(registerId: number, shiftId: number): Observable<CashOperation[]> { return this.http.get<CashOperation[]>(`${this.base}/${registerId}/shifts/${shiftId}/operations`); }
  serviceOperation(registerId: number, shiftId: number, incoming: boolean, amount: number, description: string): Observable<CashOperation> {
    return this.http.post<CashOperation>(`${this.base}/${registerId}/shifts/${shiftId}/${incoming ? 'service-in' : 'service-out'}`, { amount, description });
  }
  closeShift(registerId: number, shiftId: number, actualBalance: number): Observable<{ shift: CashShift; snapshot: string }> {
    return this.http.post<{ shift: CashShift; snapshot: string }>(`${this.base}/${registerId}/shifts/${shiftId}/z-report`, { actualBalance });
  }
  xReport(registerId: number, shiftId: number): Observable<CashRegisterReport> { return this.http.get<CashRegisterReport>(`${this.base}/${registerId}/shifts/${shiftId}/x-report`); }
  report(hotelId: number, from: string, to: string): Observable<{ operations: CashOperation[]; totalsByLegalEntity: CashLegalEntityTotals[] }> {
    const params = new HttpParams().set('hotelId', hotelId).set('from', from).set('to', to);
    return this.http.get<{ operations: CashOperation[]; totalsByLegalEntity: CashLegalEntityTotals[] }>('http://localhost:8080/api/cash-reports/operations', { params });
  }
}
