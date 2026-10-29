import { AccrualResponse } from './accrual-response.model';
import { PaymentResponse } from './payment-response.model';
import { FolioStatus } from '../enums/folio-status.enum';

export interface FolioResponse {
  id: number;
  reservationId: number;
  status: FolioStatus;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  advanceAmount: number;
  accruals: AccrualResponse[];
  payments: PaymentResponse[];
}
