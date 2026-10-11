import { DocumentType } from '../enums/document-type.enum';

export interface GuestDocumentResponse {
  id: number;
  documentType: DocumentType;
  documentNumber: string;
  issueDate: string;
  expiryDate: string | null;
}
