
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProfileRequest } from '../models/profile/profile-request.model';
import { ProfileResponse } from '../models/profile/profile-response.model';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/profiles';

  getById(id: number): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>(`${this.apiUrl}/${id}`);
  }

  getAll(): Observable<ProfileResponse[]> {
    return this.http.get<ProfileResponse[]>(this.apiUrl);
  }

  create(request: ProfileRequest): Observable<ProfileResponse> {
    return this.http.post<ProfileResponse>(this.apiUrl, request);
  }

  update(id: number, request: ProfileRequest): Observable<ProfileResponse> {
    return this.http.put<ProfileResponse>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/${id}`, {
      responseType: 'text'
    });
  }
}
