import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {RoomUnavailabilityRequest} from '../models/hotel/room-unavailability-request.model';
import {RoomUnavailabilityResponse} from '../models/hotel/room-unavailability-response.model';

@Injectable({
  providedIn: 'root'
})
export class RoomUnavailabilityService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = 'http://localhost:8080/api/room-unavailabilities';

  create(
    request: RoomUnavailabilityRequest
  ): Observable<RoomUnavailabilityResponse> {
    return this.http.post<RoomUnavailabilityResponse>(
      this.apiUrl,
      request
    );
  }

  getByRoomId(
    roomId: number
  ): Observable<RoomUnavailabilityResponse[]> {
    return this.http.get<RoomUnavailabilityResponse[]>(
      `${this.apiUrl}/room/${roomId}`
    );
  }

  finishEarly(
    repairId: number
  ): Observable<RoomUnavailabilityResponse> {
    return this.http.patch<RoomUnavailabilityResponse>(
      `${this.apiUrl}/${repairId}/finish`,
      {}
    );
  }
}
