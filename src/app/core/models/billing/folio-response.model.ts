import { FolioStatus } from '../enums/folio-status.enum';
import { AccrualResponse } from './accrual-response.model';
import { PaymentResponse } from './payment-response.model';

export interface FolioResponse {
  id: number;
  hotelId: number;
  reservationId: number | null;
  recipientId: number | null;
  payerId: number | null;
  status: FolioStatus;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  createdAt: string;
  closedAt: string | null;
  accruals: AccrualResponse[];
  payments: PaymentResponse[];
}
