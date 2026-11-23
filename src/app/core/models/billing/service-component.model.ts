import { ComponentPriceSource } from '../enums/component-price-source.enum';
import { ComponentQuantityBasis } from '../enums/component-quantity-basis.enum';

export interface ServiceComponentRequest {
  rateId?: number | null;
  parentFacilityId?: number | null;
  facilityId: number;
  priceSource: ComponentPriceSource;
  quantityBasis: ComponentQuantityBasis;
  multiplier: number;
  included: boolean;
  sortOrder: number;
  active: boolean;
}

export interface ServiceComponentResponse extends ServiceComponentRequest {
  id: number;
  rateId: number | null;
  parentFacilityId: number | null;
  facilityName: string;
}
