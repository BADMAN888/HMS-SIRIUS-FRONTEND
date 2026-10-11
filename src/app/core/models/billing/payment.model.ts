import {PaymentMethod} from '../enums/payment-method.enum';


export interface Payment {
  id: number;
  folioId: number;
  method: PaymentMethod;
  amount: number;
  description: string;
  paidAt: string;
}
