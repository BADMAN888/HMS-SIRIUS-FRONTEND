export type CashOperationType = 'PAYMENT' | 'REFUND' | 'SERVICE_IN' | 'SERVICE_OUT';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER';
export interface CashRegister {
  id: number; hotelId: number; hotelName: string; legalEntityId: number; legalEntityName: string;
  legalEntityShortName: string; edrpou: string; name: string; currency: string; active: boolean; createdAt: string;
}
export interface CashShift {
  id: number; cashRegisterId: number; status: 'OPEN' | 'CLOSED'; openedByUserId: number; openedByEmail: string;
  openedAt: string; openingBalance: number; cashPayments: number; cashRefunds: number; serviceIn: number;
  serviceOut: number; currentCash: number; cardPayments: number; bankTransferPayments: number; operationCount: number;
  closedAt: string | null; closingBalanceExpected: number | null; closingBalanceActual: number | null; difference: number | null;
}
export interface CashOperation {
  id: number; cashRegisterId: number; cashRegisterName: string; shiftId: number; legalEntityId: number;
  legalEntityName: string; operationType: CashOperationType; paymentMethod: PaymentMethod; amount: number;
  description: string | null; operationDate: string; paymentId: number | null; folioId: number | null;
  reservationId: number | null; reservationNumber: string | null; performedByEmail: string;
}
export interface CashLegalEntityTotals {
  legalEntityId: number; legalEntityName: string; legalEntityShortName: string; edrpou: string;
  receipts: number; outflows: number; netMovement: number; cash: number; card: number; bankTransfer: number;
  serviceIn: number; serviceOut: number; refunds: number;
}
export interface CashRegisterReport {
  id: number | null; reportType: 'X' | 'Z'; generatedAt: string; snapshot: string;
  shift: CashShift; cashRegister: CashRegister; operations: CashOperation[];
}
