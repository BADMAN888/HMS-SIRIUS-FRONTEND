export interface AccrualRequest {
  facilityId: number;
  reservationId: number | null;
  recipientId: number | null;
  folioId: number | null;
  serviceDate: string;
  quantity: number;
}
