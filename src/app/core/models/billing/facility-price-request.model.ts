export interface FacilityPriceRequest {
  facilityId: number;
  price: number;
  validFrom: string;
  validTo: string | null;
}
