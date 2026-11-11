import { FacilityType } from '../enums/facility-type.enum';
import { TaxStatus } from '../enums/tax-status.enum';

export interface FacilityRequest {
  hotelId: number;
  name: string;
  description: string | null;
  unit: string;
  active: boolean;
  type: FacilityType;
  taxStatus: TaxStatus | null;
}
