export interface FacilityPriceResponse {
  id: number;
  facilityId: number;
  facilityName: string;
  price: number;
  validFrom: string;
  validTo: string | null;
}
