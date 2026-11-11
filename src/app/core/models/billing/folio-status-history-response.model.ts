import { FolioStatus } from '../enums/folio-status.enum';

export interface FolioStatusHistoryResponse {
  id: number;
  folioId: number;
  status: FolioStatus;
  reason: string | null;
  changedBy: string | null;
  changedAt: string;
}
