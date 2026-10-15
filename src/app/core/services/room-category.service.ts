
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RoomCategoryRequest } from '../models/hotel/room-category-request.model';
import { RoomCategoryResponse } from '../models/hotel/room-category-response.model';

@Injectable({
  providedIn: 'root'
})
export class RoomCategoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/room-category';

  getById(id: number): Observable<RoomCategoryResponse> {
    return this.http.get<RoomCategoryResponse>(`${this.apiUrl}/${id}`);
  }

  getAll(): Observable<RoomCategoryResponse[]> {
    return this.http.get<RoomCategoryResponse[]>(this.apiUrl);
  }

  getAllByHotelId(hotelId: number): Observable<RoomCategoryResponse[]> {
    return this.http.get<RoomCategoryResponse[]>(
      `${this.apiUrl}/by-hotel/${hotelId}`
    );
  }

  create(request: RoomCategoryRequest): Observable<RoomCategoryResponse> {
    return this.http.post<RoomCategoryResponse>(this.apiUrl, request);
  }

  update(
    id: number,
    request: RoomCategoryRequest
  ): Observable<RoomCategoryResponse> {
    return this.http.put<RoomCategoryResponse>(
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
