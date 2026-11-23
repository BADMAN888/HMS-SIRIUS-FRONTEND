export interface RateQuoteItem {
  facilityId: number | null;
  name: string;
  serviceDate: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  included: boolean;
  componentId: number | null;
}

export interface RateQuoteResponse {
  rateId: number;
  currency: string;
  nights: number;
  total: number;
  components: RateQuoteItem[];
}
