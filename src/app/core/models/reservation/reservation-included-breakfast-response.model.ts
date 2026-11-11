export interface ReservationIncludedBreakfastResponse {
  id: number;
  reservationId: number;
  serviceDate: string;
  quantity: number;
  servedQuantity: number;
  remainingQuantity: number;
  cancelled: boolean;
}
