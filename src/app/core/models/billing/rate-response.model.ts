export interface RateResponse {
  id: number;
  name: string;
  description: string | null;
  currency: string;
  categoryId: number;
  currentPrice: number;
  active: boolean;
  breakfastIncluded: boolean;
}
