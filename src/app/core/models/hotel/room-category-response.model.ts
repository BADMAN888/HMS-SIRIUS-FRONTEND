export interface RoomCategoryResponse {
  id: number;
  name: string;
  description: string | null;
  countOfBeds: number;
  hotelId: number | null;
}
