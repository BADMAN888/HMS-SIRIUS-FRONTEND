export interface PriceResponse {
  id: number;
  rateId: number;
  price: number;
  validFrom: string;
  validTo: string | null;
}
