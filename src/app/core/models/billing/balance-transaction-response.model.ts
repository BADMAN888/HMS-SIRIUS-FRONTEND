import { BalanceTransactionType } from '../enums/balance-transaction-type.enum';

export interface BalanceTransactionResponse {
  id: number;
  balanceAccountId: number;
  type: BalanceTransactionType;
  amount: number;
  balanceAfter: number;
  description: string | null;
  reservationId: number | null;
  folioId: number | null;
  createdAt: string;
}
