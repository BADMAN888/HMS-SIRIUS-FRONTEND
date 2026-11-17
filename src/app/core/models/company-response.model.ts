import { OrganizationalLegalForm } from './enums/organizational-legal-form.enum';
import { LegalEntityResponse } from './legal-entity-response.model';

export interface CompanyResponse {
  id: number;
  legalEntityId: number;
  legalEntity: LegalEntityResponse;
  fullName: string;
  shortName: string;
  edrpou: string;
  registrationDate: string | null;
  organizationalLegalForm: OrganizationalLegalForm;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
