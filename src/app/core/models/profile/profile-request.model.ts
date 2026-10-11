
import { GuestDocumentRequest } from './guest-document-request.model';
import {Gender} from '../enums/gender.enum';

export interface ProfileRequest {
  firstName: string;
  lastName: string;
  middleName: string | null;
  phoneNumber: string | null;
  email: string | null;
  gender: Gender | null;
  address: string | null;
  guestDocument: GuestDocumentRequest | null;
}
