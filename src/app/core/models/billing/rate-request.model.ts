export interface RateRequest {
  name: string;
  description: string | null;
  currency: string;
  categoryId: number;
  active: boolean;
  breakfastIncluded: boolean;
}
