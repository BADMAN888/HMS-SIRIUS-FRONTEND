import {PriceStatus} from '../enums/price-status.enum';


export interface PriceResponse {
  id: number;
  rateId: number;
  rateName: string;
  roomCategoryId: number;
  roomCategoryName: string;
  amount: number;
  validFrom: string;
  validTo: string | null;
  status: PriceStatus;
}
