export interface AccrualResponse {
  id: number;
  hotelId: number;
  reservationId: number | null;
  recipientId: number | null;
  folioId: number | null;
  facilityId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  serviceDate: string;
  accruedAt: string;
  reversed: boolean;
  reversalOfId: number | null;
}
