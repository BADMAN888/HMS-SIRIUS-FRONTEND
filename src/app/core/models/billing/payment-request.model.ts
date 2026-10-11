import {PaymentMethod} from '../enums/payment-method.enum';

export interface PaymentRequest {
  folioId: number;
  method: PaymentMethod;
  amount: number;
  description: string | null;
}
