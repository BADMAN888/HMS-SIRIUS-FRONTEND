import { LegalEntityResponse } from '../legal-entity-response.model';

export interface HotelResponse {
  id: number;
  hotelName: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  checkInTime: string | null;
  earlyCheckInTime: string | null;
  checkOutTime: string | null;
  lateCheckOutTime: string | null;
  legalEntities: LegalEntityResponse[];
}
