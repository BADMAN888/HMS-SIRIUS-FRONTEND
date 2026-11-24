import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { HotelService } from '../../core/services/hotel.service';
import { RoomService } from '../../core/services/room.service';
import { RoomCategoryService } from '../../core/services/room-category.service';
import { RoomUnavailabilityService } from '../../core/services/room-unavailability.service';
import { LegalEntityService } from '../../core/services/legal-entity.service';
import { HotelRequest } from '../../core/models/hotel/hotel-request.model';
import { HotelResponse } from '../../core/models/hotel/hotel-response.model';
import { RoomResponse } from '../../core/models/hotel/room-response.model';
import { RoomCategoryResponse } from '../../core/models/hotel/room-category-response.model';
import { LegalEntityResponse } from '../../core/models/legal-entity-response.model';
import { RoomRequest } from '../../core/models/hotel/room-request.model';
import { RoomCategoryRequest } from '../../core/models/hotel/room-category-request.model';
import { RoomUnavailabilityRequest } from '../../core/models/hotel/room-unavailability-request.model';
import { RoomUnavailabilityResponse } from '../../core/models/hotel/room-unavailability-response.model';
import { RoomCleanlinessRequest } from '../../core/models/hotel/room-cleanliness-request.model';
import { RoomStatus } from '../../core/models/enums/room-status.enum';
import { RoomView } from '../../core/models/enums/room-view.enum';
import { RoomUnavailabilityStatus } from '../../core/models/enums/room-unavailability-status.enum';

@Component({ selector: 'app-hotel-admin', standalone: true, imports: [FormsModule, DatePipe], templateUrl: './hotel-admin.html', styleUrl: './hotel-admin.scss' })
export class HotelAdmin implements OnInit {
  private readonly hotelsApi = inject(HotelService); private readonly roomsApi = inject(RoomService);
  private readonly categoriesApi = inject(RoomCategoryService); private readonly unavailabilityApi = inject(RoomUnavailabilityService);
  private readonly legalApi = inject(LegalEntityService);
  readonly hotels = signal<HotelResponse[]>([]); readonly hotel = signal<HotelResponse | null>(null);
  readonly categories = signal<RoomCategoryResponse[]>([]); readonly rooms = signal<RoomResponse[]>([]);
  readonly legalEntities = signal<LegalEntityResponse[]>([]); readonly unavailable = signal<RoomUnavailabilityResponse[]>([]);
  readonly section = signal<'information'|'rooms'>('information'); readonly busy = signal(false); readonly error = signal(''); readonly notice = signal('');
  readonly RoomStatus = RoomStatus; readonly RoomView = RoomView; readonly UnavailabilityStatus = RoomUnavailabilityStatus;
  readonly roomStatuses = Object.values(RoomStatus); readonly roomViews = Object.values(RoomView);
  hotelForm: HotelRequest = this.emptyHotel(); categoryForm: RoomCategoryRequest = this.emptyCategory(); roomForm: RoomRequest = this.emptyRoom();
  editingCategory: number | null = null; editingRoom: number | null = null; selectedRoomId: number | null = null;
  unavailabilityForm: RoomUnavailabilityRequest = { roomId: 0, status: RoomUnavailabilityStatus.OUT_OF_SERVICE, startAt: '', endAt: '', reason: '' };
  legalIds = new Set<number>();
  ngOnInit(): void { this.loadHotels(); }
  private emptyHotel(): HotelRequest { return { hotelName: '', description: '', address: '', email: '', phone: '', checkInTime: '', earlyCheckInTime: '', checkOutTime: '', lateCheckOutTime: '' }; }
  private emptyCategory(): RoomCategoryRequest { return { name: '', description: '', countOfBeds: 1, hotelId: this.hotel()?.id ?? 0 }; }
  private emptyRoom(): RoomRequest { return { roomNumber: '', floor: 1, status: RoomStatus.AVAILABLE, roomView: RoomView.CITY, hotelId: this.hotel()?.id ?? 0, categoryId: 0 }; }
  loadHotels(): void {
    this.busy.set(true); this.error.set('');
    this.hotelsApi.getAll().subscribe({ next: list => { this.hotels.set(list ?? []); const current = list?.[0]; if (current) this.selectHotel(current); else { this.hotel.set(null); this.busy.set(false); } }, error: e => this.fail(e) });
  }
  selectHotel(hotel: HotelResponse): void {
    this.hotel.set(hotel); this.hotelForm = { hotelName: hotel.hotelName, description: hotel.description ?? '', phone: hotel.phone ?? '', email: hotel.email ?? '', address: hotel.address ?? '', checkInTime: hotel.checkInTime ?? '', earlyCheckInTime: hotel.earlyCheckInTime ?? '', checkOutTime: hotel.checkOutTime ?? '', lateCheckOutTime: hotel.lateCheckOutTime ?? '' };
    this.legalIds = new Set((hotel.legalEntities ?? []).map(item => item.id)); this.categoryForm = { ...this.emptyCategory(), hotelId: hotel.id }; this.roomForm = { ...this.emptyRoom(), hotelId: hotel.id };
    this.busy.set(true); forkJoin({ cats: this.categoriesApi.getAllByHotelId(hotel.id), rooms: this.roomsApi.getAllByHotelId(hotel.id), legal: this.legalApi.getAll() }).subscribe({ next: x => { this.categories.set(x.cats ?? []); this.rooms.set(x.rooms ?? []); this.legalEntities.set((x.legal ?? []).filter(item => item.active)); this.busy.set(false); }, error: e => this.fail(e) });
  }
  saveHotel(): void { const h = this.hotel(); if (!h) return; this.run(this.hotelsApi.updateHotel(h.id, this.hotelForm), updated => { this.hotel.set(updated); this.notice.set('Інформацію про готель збережено.'); }); }
  toggleLegal(id: number, checked: boolean): void { checked ? this.legalIds.add(id) : this.legalIds.delete(id); }
  saveLegalEntities(): void { const h=this.hotel(); if (!h) return; this.run(this.hotelsApi.setLegalEntities(h.id, [...this.legalIds]), updated => { this.hotel.set(updated); this.notice.set('Юридичні особи оновлено.'); }); }
  saveCategory(): void { const h=this.hotel(); if (!h || !this.categoryForm.name.trim() || this.categoryForm.countOfBeds < 1) return; const req={...this.categoryForm, hotelId:h.id}; const op=this.editingCategory ? this.categoriesApi.update(this.editingCategory,req) : this.categoriesApi.create(req); this.run(op,()=>{ this.categoryForm=this.emptyCategory(); this.editingCategory=null; this.loadHotelData(h.id); this.notice.set('Категорію збережено.'); }); }
  editCategory(c: RoomCategoryResponse): void { this.editingCategory=c.id; this.categoryForm={name:c.name,description:c.description,countOfBeds:c.countOfBeds,hotelId:c.hotelId}; }
  cancelCategory(): void { this.editingCategory=null; this.categoryForm=this.emptyCategory(); }
  deleteCategory(c: RoomCategoryResponse): void { if (this.rooms().some(r=>r.categoryId===c.id) || !confirm(`Видалити категорію «${c.name}»?`)) return; this.run(this.categoriesApi.delete(c.id),()=>{this.loadHotelData(c.hotelId);this.notice.set('Категорію видалено.');}); }
  saveRoom(): void { const h=this.hotel(); if(!h || !this.roomForm.roomNumber.trim() || !this.roomForm.categoryId) return; const req={...this.roomForm,hotelId:h.id}; const op=this.editingRoom ? this.roomsApi.update(this.editingRoom,req) : this.roomsApi.create(req); this.run(op,()=>{this.roomForm=this.emptyRoom();this.editingRoom=null;this.loadHotelData(h.id);this.notice.set('Номер збережено.');}); }
  editRoom(r: RoomResponse): void { this.editingRoom=r.id; this.roomForm={roomNumber:r.roomNumber,floor:r.floor ?? 1,status:r.status,roomView:r.roomView,hotelId:r.hotelId ?? this.hotel()?.id ?? 0,categoryId:r.categoryId ?? 0}; }
  cancelRoom(): void { this.editingRoom=null; this.roomForm=this.emptyRoom(); }
  deleteRoom(r: RoomResponse): void { if(!confirm(`Видалити номер ${r.roomNumber}?`))return; this.run(this.roomsApi.delete(r.id),()=>{this.loadHotelData(r.hotelId ?? this.hotel()!.id);this.notice.set('Номер видалено.');}); }
  toggleCleanliness(r: RoomResponse): void { const request: RoomCleanlinessRequest={clean:!r.clean}; this.run(this.roomsApi.updateRoomCleanliness(r.id,request),()=>{this.loadHotelData(r.hotelId??this.hotel()!.id);this.notice.set('Стан чистоти оновлено.');}); }
  saveUnavailability(): void { const h=this.hotel(); if(!h || this.unavailabilityForm.endAt <= this.unavailabilityForm.startAt || !this.unavailabilityForm.reason.trim())return; this.run(this.unavailabilityApi.create({...this.unavailabilityForm,roomId:this.selectedRoomId ?? this.unavailabilityForm.roomId}),()=>{this.loadUnavailable();this.notice.set('Період недоступності додано.');}); }
  showRoom(r: RoomResponse): void { this.selectedRoomId=r.id; this.unavailabilityForm={roomId:r.id,status:RoomUnavailabilityStatus.OUT_OF_SERVICE,startAt:'',endAt:'',reason:''}; this.unavailabilityApi.getByRoomId(r.id).subscribe({next:x=>this.unavailable.set(x??[]),error:e=>this.fail(e)}); }
  roomLabel(id: number): string { return this.rooms().find(r=>r.id===id)?.roomNumber ?? ''; }
  closeRoomDetails(): void { this.selectedRoomId=null; this.unavailable.set([]); }
  finishUnavailability(x: RoomUnavailabilityResponse): void { this.run(this.unavailabilityApi.finishEarly(x.id),()=>{this.loadUnavailable();this.notice.set('Недоступність завершено.');}); }
  private loadUnavailable(): void { const id=this.selectedRoomId; if(id) this.unavailabilityApi.getByRoomId(id).subscribe({next:x=>this.unavailable.set(x??[]),error:e=>this.fail(e)}); }
  private loadHotelData(id:number):void { forkJoin({cats:this.categoriesApi.getAllByHotelId(id),rooms:this.roomsApi.getAllByHotelId(id)}).subscribe({next:x=>{this.categories.set(x.cats??[]);this.rooms.set(x.rooms??[]);},error:e=>this.fail(e)}); }
  categoryName(id:number|null):string { return this.categories().find(c=>c.id===id)?.name ?? '—'; }
  private run<T>(source: import('rxjs').Observable<T>, success:(value:T)=>void):void { this.busy.set(true);this.error.set('');this.notice.set('');source.subscribe({next:value=>{this.busy.set(false);success(value);},error:e=>this.fail(e)}); }
  private fail(e:unknown):void { this.busy.set(false);const x=e as {error?:{message?:string}};this.error.set(x?.error?.message ?? 'Операція не вдалася. Перевірте дані та доступ до API.'); }
}
