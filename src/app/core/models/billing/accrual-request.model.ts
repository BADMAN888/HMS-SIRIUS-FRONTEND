import { AccrualType } from '../enums/accrual-type.enum';

export interface AccrualRequest {
  hotelId: number;
  reservationId?: number | null;
  recipientId?: number | null;
  folioId?: number | null;
  type: AccrualType;
  name: string;
  description?: string | null;
  unitPrice: number;
  quantity: number;
}
