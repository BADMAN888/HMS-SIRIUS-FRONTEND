
import { GuestDocumentResponse } from './guest-document-response.model';
import {Gender} from '../enums/gender.enum';

export interface ProfileResponse {
  id: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phoneNumber: string | null;
  email: string | null;
  gender: Gender | null;
  address: string | null;
  guestDocument: GuestDocumentResponse | null;
}
