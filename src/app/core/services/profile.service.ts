
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ProfileRequest } from '../models/profile/profile-request.model';
import { ProfileResponse } from '../models/profile/profile-response.model';
import { ProfileReservationResponse } from '../models/profile/profile-reservation-response.model';
import { HttpParams } from '@angular/common/http';

export interface ProfilePage {
  content: ProfileResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface SimilarProfilePair {
  first: ProfileResponse;
  second: ProfileResponse;
  reason: string;
}

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

  search(filters: Record<string, string | number | boolean | null>, page = 0): Observable<ProfilePage> {
    let params = new HttpParams().set('page', page).set('size', 20);
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== '') params = params.set(key, String(value));
    }
    return this.http.get<ProfilePage>(`${this.apiUrl}/search`, { params });
  }

  findSimilar(): Observable<SimilarProfilePair[]> {
    return this.http.get<SimilarProfilePair[]>(`${this.apiUrl}/similar`);
  }

  merge(keepProfileId: number, mergeProfileId: number): Observable<ProfileResponse> {
    return this.http.post<ProfileResponse>(`${this.apiUrl}/merge`, { keepProfileId, mergeProfileId });
  }

  getReservations(id: number): Observable<ProfileReservationResponse[]> {
    return this.http.get<ProfileReservationResponse[]>(
      `${this.apiUrl}/${id}/reservations`
    );
  }

  create(request: ProfileRequest): Observable<ProfileResponse> {
    return this.http.post<ProfileResponse>(this.apiUrl, request);
  }

  update(id: number, request: ProfileRequest): Observable<ProfileResponse> {
    return this.http.put<ProfileResponse>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
