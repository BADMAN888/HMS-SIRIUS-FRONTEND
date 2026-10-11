export interface HotelResponse {
  id: number;
  hotelName: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  checkInTime: string;
  checkOutTime: string;
}
