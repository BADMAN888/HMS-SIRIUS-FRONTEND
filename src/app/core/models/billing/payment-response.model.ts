import {PaymentMethod} from '../enums/payment-method.enum';


export interface PaymentResponse {
  id: number;
  folioId: number;
  method: PaymentMethod;
  amount: number;
  description: string | null;
  paidAt: string;
}
