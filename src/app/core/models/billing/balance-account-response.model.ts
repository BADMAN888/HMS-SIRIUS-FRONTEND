import { BalanceAccountStatus } from '../enums/balance-account-status.enum';

export interface BalanceAccountResponse {
  id: number;
  profileId: number;
  hotelId: number;
  balance: number;
  currency: string;
  status: BalanceAccountStatus;
  createdAt: string;
  updatedAt: string;
}
