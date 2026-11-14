
import { Gender } from '../enums/gender.enum';
import { GuestDocumentResponse } from './guest-document-response.model';

export interface ProfileResponse {
  id: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phoneNumber: string | null;
  email: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  citizenship: string | null;
  taxNumber: string | null;
  address: string | null;
  registrationAddress: string | null;
  guestDocuments: GuestDocumentResponse[];
}
