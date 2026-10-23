import { Gender } from '../enums/gender.enum';
import { GuestDocument } from './guest-document.model';

export interface ProfileResponse {
  id: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phoneNumber: string;
  email: string;
  gender: Gender;
  address: string;
  guestDocument: GuestDocument;
}
