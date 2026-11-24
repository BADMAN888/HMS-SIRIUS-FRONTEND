import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of, throwError } from 'rxjs';
import { HotelResponse } from '../../core/models/hotel/hotel-response.model';
import { RoomResponse } from '../../core/models/hotel/room-response.model';
import { ReservationResponse } from '../../core/models/reservation/reservation-response.model';
import { RoomUnavailabilityResponse } from '../../core/models/hotel/room-unavailability-response.model';
import { RoomStatus } from '../../core/models/enums/room-status.enum';
import { RoomUnavailabilityStatus } from '../../core/models/enums/room-unavailability-status.enum';
import { ReservationStatus } from '../../core/models/enums/reservation-status.enum';
import { HousekeepingTaskStatus } from '../../core/models/housekeeping/housekeeping-task-status.enum';
import { HousekeepingTaskType } from '../../core/models/housekeeping/housekeeping-task-type.enum';
import { HousekeepingPlanResponse } from '../../core/models/housekeeping/housekeeping-plan-response.model';
import { HousekeepingTaskResponse } from '../../core/models/housekeeping/housekeeping-task-response.model';
import { HotelService } from '../../core/services/hotel.service';
import { RoomService } from '../../core/services/room.service';
import { ReservationService } from '../../core/services/reservation.service';
import { RoomUnavailabilityService } from '../../core/services/room-unavailability.service';
import { HousekeepingService } from '../../core/services/housekeeping.service';

type HousekeepingSection = 'day' | 'repairs';

@Component({
  selector: 'app-housekeeping',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './housekeeping.html',
  styleUrl: './housekeeping.scss'
})
export class Housekeeping implements OnInit {
  private readonly hotelApi = inject(HotelService);
  private readonly roomApi = inject(RoomService);
  private readonly reservationApi = inject(ReservationService);
  private readonly repairApi = inject(RoomUnavailabilityService);
  private readonly housekeepingApi = inject(HousekeepingService);

  readonly hotels = signal<HotelResponse[]>([]);
  readonly hotelId = signal<number | null>(null);
  readonly date = signal(this.localDate(new Date()));
  readonly rooms = signal<RoomResponse[]>([]);
  readonly reservations = signal<ReservationResponse[]>([]);
  readonly repairs = signal<RoomUnavailabilityResponse[]>([]);
  readonly plan = signal<HousekeepingPlanResponse | null>(null);
  readonly section = signal<HousekeepingSection>('day');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly query = signal('');
  readonly floorFilter = signal('');
  readonly repairRoomIds = signal<number[]>([]);
  readonly roomStatuses = Object.values(RoomStatus);
  readonly taskStatuses = Object.values(HousekeepingTaskStatus);
  readonly repairStatuses = Object.values(RoomUnavailabilityStatus);

  attendantCount = 3;
  repairStartAt = `${this.localDate(new Date())}T08:00`;
  repairEndAt = `${this.localDate(this.addDays(new Date(), 1))}T18:00`;
  repairStatus = RoomUnavailabilityStatus.OUT_OF_SERVICE;
  repairReason = '';

  readonly floors = computed(() => [...new Set(this.rooms().map(room => room.floor).filter((floor): floor is number => floor !== null))].sort((a,b)=>a-b));
  readonly filteredRooms = computed(() => this.rooms().filter(room =>
    (!this.floorFilter() || String(room.floor) === this.floorFilter()) &&
    (!this.query().trim() || room.roomNumber.toLocaleLowerCase().includes(this.query().trim().toLocaleLowerCase()))
  ));
  readonly taskCount = computed(() => this.plan()?.tasks.length ?? 0);
  readonly completedCount = computed(() => this.plan()?.tasks.filter(task => task.status === HousekeepingTaskStatus.CLEANED || task.status === HousekeepingTaskStatus.INSPECTED).length ?? 0);
  readonly totalWorkMinutes = computed(() => this.plan()?.tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0) ?? 0);
  readonly attendantWorkloads = computed(() => {
    const plan = this.plan();
    if (!plan) return [];
    return Array.from({ length: plan.attendantCount }, (_, index) => {
      const number = index + 1;
      const tasks = plan.tasks.filter(task => task.attendantNumber === number)
        .sort((a, b) => a.priority - b.priority || a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
      return { number, tasks, minutes: tasks.reduce((total, task) => total + task.estimatedMinutes, 0) };
    });
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.hotelApi.getAll().subscribe({
      next: hotels => {
        this.hotels.set(hotels ?? []);
        const firstHotel = hotels?.[0];
        if (firstHotel) {
          this.hotelId.set(firstHotel.id);
          this.loadDay();
        } else {
          this.loading.set(false);
        }
      },
      error: error => this.fail(error)
    });
  }

  selectHotel(id: number | string): void {
    this.hotelId.set(Number(id));
    this.repairRoomIds.set([]);
    this.loadDay();
  }

  changeDate(value: string): void {
    if (!value) return;
    this.date.set(value);
    this.loadDay();
  }

  setSection(section: HousekeepingSection): void {
    this.section.set(section);
    this.error.set('');
    if (section === 'repairs') this.loadRepairs();
  }

  loadDay(preserveNotice = false): void {
    const hotelId = this.hotelId();
    if (!hotelId) return;
    const date = this.date();
    const startAt = `${date}T00:00:00`;
    const endAt = `${this.localDate(this.addDays(new Date(`${date}T12:00:00`), 1))}T00:00:00`;
    this.loading.set(true);
    this.error.set('');
    if (!preserveNotice) this.notice.set('');
    forkJoin({
      rooms: this.roomApi.getAllByHotelId(hotelId),
      reservations: this.reservationApi.getByDate(date),
      repairs: this.repairApi.getByHotelAndPeriod(hotelId, startAt, endAt),
      plan: this.housekeepingApi.getPlan(hotelId, date).pipe(catchError(error => error?.status === 404 ? of(null) : throwError(() => error)))
    }).subscribe({
      next: data => {
        this.rooms.set(data.rooms ?? []);
        this.reservations.set((data.reservations ?? []).filter(reservation => reservation.room.hotelId === hotelId && reservation.status !== ReservationStatus.CANCELLED && reservation.status !== ReservationStatus.NO_SHOW));
        this.repairs.set(data.repairs ?? []);
        this.plan.set(data.plan);
        if (data.plan) this.attendantCount = data.plan.attendantCount;
        this.loading.set(false);
      },
      error: error => this.fail(error)
    });
  }

  prepareWork(): void {
    const hotelId = this.hotelId();
    if (!hotelId || !Number.isInteger(this.attendantCount) || this.attendantCount < 1 || this.attendantCount > 50) {
      this.error.set('Вкажіть від 1 до 50 покоївок.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    this.housekeepingApi.generate({ hotelId, serviceDate: this.date(), attendantCount: this.attendantCount }).subscribe({
      next: plan => {
        this.plan.set(plan);
        this.saving.set(false);
        this.notice.set(`План підготовлено: ${plan.tasks.length} завдань для ${plan.attendantCount} покоївок.`);
      },
      error: error => this.fail(error)
    });
  }

  taskFor(roomId: number): HousekeepingTaskResponse | null {
    return this.plan()?.tasks.find(task => task.roomId === roomId) ?? null;
  }

  repairFor(roomId: number): RoomUnavailabilityResponse | null {
    return this.repairs().find(repair => repair.roomId === roomId && repair.completedAt === null) ?? null;
  }

  roomStatusChanged(room: RoomResponse, status: RoomStatus): void {
    if (room.status === status) return;
    this.saving.set(true);
    this.error.set('');
    this.roomApi.updateRoomStatus(room.id, { status }).subscribe({
      next: updated => {
        this.rooms.update(rooms => rooms.map(item => item.id === updated.id ? updated : item));
        this.saving.set(false);
      },
      error: error => this.fail(error)
    });
  }

  taskStatusChanged(task: HousekeepingTaskResponse, status: HousekeepingTaskStatus): void {
    this.updateTask(task, status, task.attendantNumber, task.notes);
  }

  attendantChanged(task: HousekeepingTaskResponse, attendant: number | string): void {
    this.updateTask(task, task.status, Number(attendant), task.notes);
  }

  notesChanged(task: HousekeepingTaskResponse, notes: string): void {
    this.updateTask(task, task.status, task.attendantNumber, notes);
  }

  toggleRepairRoom(roomId: number, checked: boolean): void {
    this.repairRoomIds.update(ids => checked ? [...new Set([...ids, roomId])] : ids.filter(id => id !== roomId));
  }

  createRepair(): void {
    const hotelId = this.hotelId();
    const selectedIds = this.repairRoomIds();
    if (!hotelId || !selectedIds.length || !this.repairReason.trim() || !this.repairStartAt || !this.repairEndAt) {
      this.error.set('Оберіть номери, період і вкажіть причину ремонту.');
      return;
    }
    if (this.repairEndAt <= this.repairStartAt) {
      this.error.set('Завершення ремонту має бути пізніше початку.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.repairApi.createBatch({
      hotelId,
      roomIds: selectedIds,
      status: this.repairStatus,
      startAt: `${this.repairStartAt}:00`,
      endAt: `${this.repairEndAt}:00`,
      reason: this.repairReason.trim()
    }).subscribe({
      next: created => {
        this.repairRoomIds.set([]);
        this.repairReason = '';
        this.repairs.update(items => [...created, ...items]);
        this.saving.set(false);
        this.notice.set(`Додано ремонтів: ${created.length}.`);
        this.loadDay(true);
      },
      error: error => this.fail(error)
    });
  }

  finishRepair(repair: RoomUnavailabilityResponse): void {
    if (repair.completedAt || !confirm(`Завершити ремонт номера ${repair.roomNumber} зараз?`)) return;
    this.saving.set(true);
    this.repairApi.finishEarly(repair.id).subscribe({
      next: updated => {
        this.repairs.update(items => items.map(item => item.id === updated.id ? updated : item));
        this.saving.set(false);
        this.notice.set(`Ремонт номера ${updated.roomNumber} завершено.`);
        this.loadDay(true);
      },
      error: error => this.fail(error)
    });
  }

  printPlan(): void {
    window.print();
  }

  attendantNumbers(): number[] {
    return Array.from({ length: this.plan()?.attendantCount ?? this.attendantCount }, (_, index) => index + 1);
  }

  taskTypeLabel(type: HousekeepingTaskType): string {
    const labels: Record<HousekeepingTaskType, string> = {
      [HousekeepingTaskType.TURNOVER]: 'Виїзд + заїзд',
      [HousekeepingTaskType.CHECKOUT]: 'Прибирання після виїзду',
      [HousekeepingTaskType.ARRIVAL]: 'Підготовка до заїзду',
      [HousekeepingTaskType.VACANT_DIRTY]: 'Вільний брудний номер',
      [HousekeepingTaskType.STAYOVER]: 'Stayover · прибирання під час проживання'
    };
    return labels[type];
  }

  taskStatusLabel(status: HousekeepingTaskStatus): string {
    const labels: Record<HousekeepingTaskStatus, string> = {
      [HousekeepingTaskStatus.PENDING]: 'Заплановано',
      [HousekeepingTaskStatus.IN_PROGRESS]: 'У роботі',
      [HousekeepingTaskStatus.CLEANED]: 'Прибрано',
      [HousekeepingTaskStatus.INSPECTED]: 'Перевірено',
      [HousekeepingTaskStatus.SKIPPED]: 'Пропущено'
    };
    return labels[status];
  }

  repairStatusLabel(status: RoomUnavailabilityStatus): string {
    return status === RoomUnavailabilityStatus.OUT_OF_ORDER ? 'OUT_OF_ORDER' : 'OUT_OF_SERVICE';
  }

  guestLabel(task: HousekeepingTaskResponse): string {
    if (task.taskType === HousekeepingTaskType.TURNOVER) {
      return [task.departureGuest, task.arrivalGuest].filter(Boolean).join(' → ') || '—';
    }
    return task.arrivalGuest ?? task.departureGuest ?? '—';
  }

  bookingSchedule(task: HousekeepingTaskResponse): string {
    const checkout = task.checkOutAt?.slice(11, 16);
    const checkin = task.checkInAt?.slice(11, 16);
    if (task.taskType === HousekeepingTaskType.TURNOVER) {
      return `Виїзд ${checkout ?? '—'} · заїзд ${checkin ?? '—'}`;
    }
    if (task.taskType === HousekeepingTaskType.CHECKOUT) return checkout ? `Виїзд ${checkout}` : '';
    if (task.taskType === HousekeepingTaskType.ARRIVAL) return checkin ? `Заїзд ${checkin}` : '';
    return '';
  }

  private updateTask(task: HousekeepingTaskResponse, status: HousekeepingTaskStatus, attendantNumber: number, notes: string | null): void {
    const plan = this.plan();
    if (!plan || attendantNumber < 1 || attendantNumber > plan.attendantCount) return;
    this.saving.set(true);
    this.error.set('');
    this.housekeepingApi.updateTask(task.id, { status, attendantNumber, notes }).subscribe({
      next: updated => {
        this.plan.update(current => current ? { ...current, tasks: current.tasks.map(item => item.id === updated.id ? updated : item) } : current);
        this.rooms.update(rooms => rooms.map(room => room.id === updated.roomId ? { ...room, status: updated.roomStatus, clean: updated.roomClean } : room));
        this.saving.set(false);
      },
      error: error => this.fail(error)
    });
  }

  private loadRepairs(): void {
    const hotelId = this.hotelId();
    if (!hotelId) return;
    this.repairApi.getByHotelAndPeriod(hotelId, `${this.date()}T00:00:00`, `${this.localDate(this.addDays(new Date(`${this.date()}T12:00:00`), 1))}T00:00:00`).subscribe({
      next: repairs => this.repairs.set(repairs ?? []),
      error: error => this.fail(error)
    });
  }

  private fail(error: unknown): void {
    const response = error as { error?: { message?: string }; message?: string };
    this.error.set(response?.error?.message ?? response?.message ?? 'Не вдалося виконати операцію. Перевірте дані та доступ до сервера.');
    this.loading.set(false);
    this.saving.set(false);
  }

  private localDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
