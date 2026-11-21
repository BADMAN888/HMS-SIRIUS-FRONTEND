export interface BalanceOperationRequest {
  amount: number;
  description?: string | null;
  idempotencyKey?: string;
}
