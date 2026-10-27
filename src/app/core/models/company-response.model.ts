export interface CompanyResponse {
  id: number;
  fullName: string;
  shortName: string | null;
  edrpou: string;
  registrationDate: string | null;
  organizationalLegalForm: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
