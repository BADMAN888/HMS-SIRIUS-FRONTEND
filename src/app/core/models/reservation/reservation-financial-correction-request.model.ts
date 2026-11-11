import { ReservationFinancialCorrectionType } from '../enums/reservation-financial-correction-type.enum';
import { PaymentCorrectionAllocationRequest } from './payment-correction-allocation-request.model';

export interface ReservationFinancialCorrectionRequest {
  accrualId: number;
  amount: number;
  type: ReservationFinancialCorrectionType;
  payments: PaymentCorrectionAllocationRequest[];
  reason: string;
}
