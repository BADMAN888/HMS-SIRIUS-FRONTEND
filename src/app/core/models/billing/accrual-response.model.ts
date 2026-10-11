import { AccrualType } from './accrual-type.enum';

export interface AccrualResponse {
  id: number;
  folioId: number;
  type: AccrualType;
  description: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  accruedAt: string;
}
