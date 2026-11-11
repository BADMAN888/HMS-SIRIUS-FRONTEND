export interface PriceRequest {
  rateId: number;
  price: number;
  validFrom: string;
  validTo: string | null;
}
