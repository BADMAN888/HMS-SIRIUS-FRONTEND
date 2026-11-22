export interface PaymentRefundRequest {
  amount: number;
  reason: string;
  idempotencyKey?: string;
}
