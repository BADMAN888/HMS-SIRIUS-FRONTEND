import {DocumentType} from '../enums/document-type.enum';

export interface GuestDocument {
  id: number;
  documentType: DocumentType;
  documentNumber: string;
  issueDate: string;
  expiryDate?: string;
}
