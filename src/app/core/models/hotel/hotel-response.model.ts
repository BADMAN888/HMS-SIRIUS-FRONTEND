export interface HotelResponse {
  id: number;
  hotelName: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
}
