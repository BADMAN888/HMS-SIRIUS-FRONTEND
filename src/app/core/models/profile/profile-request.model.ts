
import { Gender } from '../enums/gender.enum';
import { Nationality } from '../enums/nationality.enum';

export interface ProfileRequest {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  placeOfBirth?: string | null;
  nationality?: Nationality | null;
  address?: string | null;
  registrationAddress?: string | null;
}
