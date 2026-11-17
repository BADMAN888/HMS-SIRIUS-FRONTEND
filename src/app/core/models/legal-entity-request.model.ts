import { OrganizationalLegalForm } from './enums/organizational-legal-form.enum';

export interface LegalEntityRequest {
  fullName: string;
  shortName: string;
  edrpou: string;
  registrationDate?: string | null;
  organizationalLegalForm: OrganizationalLegalForm;
}
