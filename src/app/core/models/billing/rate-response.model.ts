export interface RateResponse {
  id: number;
  name: string;
  description: string | null;
  currency: string;
  categoryId: number;
  price: number;
  active: boolean;
}
