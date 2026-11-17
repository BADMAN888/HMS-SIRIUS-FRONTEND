import { OrganizationalLegalForm } from './enums/organizational-legal-form.enum';

export interface LegalEntityResponse {
  id: number;
  fullName: string;
  shortName: string;
  edrpou: string;
  registrationDate: string | null;
  organizationalLegalForm: OrganizationalLegalForm;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
