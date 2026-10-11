import { DocumentType } from '../enums/document-type.enum';

export interface GuestDocumentRequest {
  documentType: DocumentType;
  documentNumber: string;
  issueDate: string;
  expiryDate: string | null;
}
