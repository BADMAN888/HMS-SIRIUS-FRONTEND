import {AccrualType} from '../enums/accrual-type.enum';


export interface AccrualRequest {
  folioId: number;
  type: AccrualType;
  description: string;
  unitPrice: number;
  quantity: number;
}
