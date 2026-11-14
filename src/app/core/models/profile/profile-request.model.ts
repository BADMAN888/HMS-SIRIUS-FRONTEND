
import { Gender } from '../enums/gender.enum';

export interface ProfileRequest {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  placeOfBirth?: string | null;
  citizenship?: string | null;
  taxNumber?: string | null;
  address?: string | null;
  registrationAddress?: string | null;
}
