export interface RateRequest {
  name: string;
  description: string | null;
  currency: string;
  categoryId: number;
  price: number;
  active: boolean;
}
