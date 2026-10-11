export interface RoomCategoryRequest {
  name: string;
  description: string | null;
  countOfBeds: number;
  hotelId: number | null;
}
