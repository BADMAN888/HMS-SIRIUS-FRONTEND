import {PriceStatus} from '../enums/price-status.enum';


export interface PriceRequest {
  rateId: number;
  roomCategoryId: number;
  amount: number;
  validFrom: string;
  validTo: string | null;
  status: PriceStatus;
}
