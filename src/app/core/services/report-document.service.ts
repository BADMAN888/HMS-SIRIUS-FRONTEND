import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type ReportDocumentFormat = 'PDF' | 'DOCX' | 'XLSX';
export interface ReportDocumentRequest {
  hotelId: number;
  hotelName: string;
  title: string;
  fromDate: string;
  toDate: string;
  columns: string[];
  rows: string[][];
}

@Injectable({ providedIn: 'root' })
export class ReportDocumentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/reports/documents';

  generate(request: ReportDocumentRequest, format: ReportDocumentFormat): Observable<Blob> {
    const params = new HttpParams().set('format', format);
    return this.http.post(this.apiUrl, request, { params, responseType: 'blob' });
  }

  preview(request: ReportDocumentRequest): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/preview`, request, { responseType: 'blob' });
  }
}
