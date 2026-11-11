import { AccrualType } from '../enums/accrual-type.enum';

export interface AccrualResponse {
  id: number;
  folioId: number;
  type: AccrualType;
  name: string;
  description: string | null;
  unitPrice: number;
  quantity: number;
  amount: number;
  accruedAt: string;
}
