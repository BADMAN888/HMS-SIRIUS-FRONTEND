export interface AccrualResponse {
  id: number;
  hotelId: number;
  reservationId: number | null;
  recipientId: number | null;
  folioId: number | null;
  facilityId: number | null;
  serviceComponentId: number | null;
  sourceRateComponentId: number | null;
  includedComponent: boolean;
  componentPriceSource: string | null;
  componentQuantityBasis: string | null;
  componentMultiplier: number | null;
  name: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  serviceDate: string;
  accruedAt: string;
  active: boolean;
}
