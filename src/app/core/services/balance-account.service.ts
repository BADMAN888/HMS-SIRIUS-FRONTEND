
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { BalanceAccountResponse } from '../models/billing/balance-account-response.model';
import { BalanceTransactionResponse } from '../models/billing/balance-transaction-response.model';
import { BalanceOperationRequest } from '../models/billing/balance-operation-request.model';

@Injectable({
  providedIn: 'root'
})
export class BalanceAccountService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/balance-accounts';

  getByProfileAndHotel(
    profileId: number,
    hotelId: number
  ): Observable<BalanceAccountResponse> {
    return this.http.get<BalanceAccountResponse>(
      `${this.apiUrl}/profile/${profileId}/hotel/${hotelId}`
    );
  }

  getOrCreate(
    profileId: number,
    hotelId: number
  ): Observable<BalanceAccountResponse> {
    return this.http.post<BalanceAccountResponse>(
      `${this.apiUrl}/profile/${profileId}/hotel/${hotelId}`,
      null
    );
  }

  deposit(
    profileId: number,
    hotelId: number,
    request: BalanceOperationRequest
  ): Observable<BalanceAccountResponse> {
    return this.http.post<BalanceAccountResponse>(
      `${this.apiUrl}/profile/${profileId}/hotel/${hotelId}/deposit`,
      request
    );
  }

  getTransactions(
    accountId: number
  ): Observable<BalanceTransactionResponse[]> {
    return this.http.get<BalanceTransactionResponse[]>(
      `${this.apiUrl}/${accountId}/transactions`
    );
  }

  refund(
    accountId: number,
    request: BalanceOperationRequest
  ): Observable<BalanceAccountResponse> {
    return this.http.post<BalanceAccountResponse>(
      `${this.apiUrl}/${accountId}/refund`,
      request
    );
  }

  debit(
    accountId: number,
    request: BalanceOperationRequest
  ): Observable<BalanceAccountResponse> {
    return this.http.post<BalanceAccountResponse>(
      `${this.apiUrl}/${accountId}/debit`,
      request
    );
  }

  payFolio(
    accountId: number,
    folioId: number,
    request: BalanceOperationRequest
  ): Observable<BalanceAccountResponse> {
    return this.http.post<BalanceAccountResponse>(
      `${this.apiUrl}/${accountId}/pay-folio/${folioId}`,
      request
    );
  }
}
