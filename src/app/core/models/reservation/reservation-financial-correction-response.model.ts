import { ReservationFinancialCorrectionType } from '../enums/reservation-financial-correction-type.enum';

export interface ReservationFinancialCorrectionResponse {
  folioId: number;
  accrualId: number;
  accrualReversalId: number;
  paymentReversalIds: number[];
  type: ReservationFinancialCorrectionType;
  amount: number;
  balanceAccountId: number | null;
}
