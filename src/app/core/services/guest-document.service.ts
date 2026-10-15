
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GuestDocumentRequest } from '../models/profile/guest-document-request.model';
import { GuestDocumentResponse } from '../models/profile/guest-document-response.model';

@Injectable({
  providedIn: 'root'
})
export class GuestDocumentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/guest-documents';

  getById(id: number): Observable<GuestDocumentResponse> {
    return this.http.get<GuestDocumentResponse>(`${this.apiUrl}/${id}`);
  }

  getAll(): Observable<GuestDocumentResponse[]> {
    return this.http.get<GuestDocumentResponse[]>(this.apiUrl);
  }

  create(request: GuestDocumentRequest): Observable<GuestDocumentResponse> {
    return this.http.post<GuestDocumentResponse>(this.apiUrl, request);
  }

  update(
    id: number,
    request: GuestDocumentRequest
  ): Observable<GuestDocumentResponse> {
    return this.http.put<GuestDocumentResponse>(
      `${this.apiUrl}/${id}`,
      request
    );
  }

  delete(id: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/${id}`, {
      responseType: 'text'
    });
  }
}
