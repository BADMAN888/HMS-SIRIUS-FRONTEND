export interface ReservationHistoryResponse {
  id: number;
  reservationId: number;
  userName: string;
  action: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
}
