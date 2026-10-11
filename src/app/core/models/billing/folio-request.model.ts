import {FolioStatus} from '../enums/folio-status.enum';


export interface FolioRequest {
  reservationId: number;
  status: FolioStatus;
}
