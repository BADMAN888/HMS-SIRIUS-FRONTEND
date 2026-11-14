
import { DocumentType } from '../enums/document-type.enum';

export interface GuestDocumentRequest {
  documentType: DocumentType;
  documentNumber: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  issuingAuthority?: string | null;
  recordNumber?: string | null;
}
