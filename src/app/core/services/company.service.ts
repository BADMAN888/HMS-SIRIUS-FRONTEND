import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CompanyRequest } from '../models/company-request.model';
import { CompanyResponse } from '../models/company-response.model';

@Injectable({
  providedIn: 'root'
})
export class CompanyService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/companies';

  getAll(): Observable<CompanyResponse[]> {
    return this.http.get<CompanyResponse[]>(this.apiUrl);
  }

  getById(id: number): Observable<CompanyResponse> {
    return this.http.get<CompanyResponse>(`${this.apiUrl}/${id}`);
  }

  create(request: CompanyRequest): Observable<CompanyResponse> {
    return this.http.post<CompanyResponse>(this.apiUrl, request);
  }

  update(
    id: number,
    request: CompanyRequest
  ): Observable<CompanyResponse> {
    return this.http.put<CompanyResponse>(
      `${this.apiUrl}/${id}`,
      request
    );
  }

  deactivate(id: number): Observable<void> {
    return this.http.patch<void>(
      `${this.apiUrl}/${id}/deactivate`,
      null
    );
  }
}
