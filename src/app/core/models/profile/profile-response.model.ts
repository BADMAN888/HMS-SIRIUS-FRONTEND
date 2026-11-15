import { Gender } from '../enums/gender.enum';
import { Nationality } from '../enums/nationality.enum';
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
  nationality: Nationality | null;
  address: string | null;
  registrationAddress: string | null;
  comment: string | null;
  vip: boolean;
  inBlackList: boolean;
  guestDocuments: GuestDocumentResponse[];
}
