import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { catchError, forkJoin, of, throwError } from 'rxjs';
import { HotelResponse } from '../../core/models/hotel/hotel-response.model';
import { RoomResponse } from '../../core/models/hotel/room-response.model';
import { ReservationResponse } from '../../core/models/reservation/reservation-response.model';
import { ReservationIncludedBreakfastResponse } from '../../core/models/reservation/reservation-included-breakfast-response.model';
import { FolioResponse } from '../../core/models/billing/folio-response.model';
import { AccrualResponse } from '../../core/models/billing/accrual-response.model';
import { CashOperation } from '../../core/models/billing/cash-register.model';
import { RoomUnavailabilityResponse } from '../../core/models/hotel/room-unavailability-response.model';
import { HousekeepingPlanResponse } from '../../core/models/housekeeping/housekeeping-plan-response.model';
import { HousekeepingTaskStatus } from '../../core/models/housekeeping/housekeeping-task-status.enum';
import { ReservationStatus } from '../../core/models/enums/reservation-status.enum';
import { HotelService } from '../../core/services/hotel.service';
import { RoomService } from '../../core/services/room.service';
import { ReservationService } from '../../core/services/reservation.service';
import { RoomUnavailabilityService } from '../../core/services/room-unavailability.service';
import { HousekeepingService } from '../../core/services/housekeeping.service';
import { FolioService } from '../../core/services/folio.service';
import { AccrualService } from '../../core/services/accrual.service';
import { CashRegisterService } from '../../core/services/cash-register.service';
import { ReportDocumentFormat, ReportDocumentRequest, ReportDocumentService } from '../../core/services/report-document.service';

interface ReportDefinition { id: string; category: string; title: string; description: string; }
type ReportRow = (string | number)[];

@Component({
  selector: 'app-reports', standalone: true, imports: [FormsModule, DatePipe],
  templateUrl: './reports.html', styleUrl: './reports.scss'
})
export class Reports implements OnInit, OnDestroy {
  private readonly hotelApi = inject(HotelService);
  private readonly roomApi = inject(RoomService);
  private readonly reservationApi = inject(ReservationService);
  private readonly repairApi = inject(RoomUnavailabilityService);
  private readonly housekeepingApi = inject(HousekeepingService);
  private readonly folioApi = inject(FolioService);
  private readonly accrualApi = inject(AccrualService);
  private readonly cashApi = inject(CashRegisterService);
  private readonly reportDocumentApi = inject(ReportDocumentService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly reports: ReportDefinition[] = [
    { id: 'manager', category: 'Зведені', title: 'Звіт менеджера', description: 'Коротке зведення бронювань, заїздів, виїздів, оплат, нарахувань і завантаженості.' },
    { id: 'bookings-created', category: 'Бронювання', title: 'Бронювання, створені за період', description: 'Список бронювань за датою створення, зі статусом, гостем, номером і джерелом.' },
    { id: 'cancellations', category: 'Бронювання', title: 'Скасовані бронювання', description: 'Скасування саме за датою скасування, з причиною та даними бронювання.' },
    { id: 'no-shows', category: 'Бронювання', title: 'Неявки гостей (No-show)', description: 'Бронювання зі статусом No-show з плановими датами проживання.' },
    { id: 'arrivals', category: 'Бронювання', title: 'Заїзди за період', description: 'Очікувані та фактичні заїзди, час прибуття, номер і гість.' },
    { id: 'departures', category: 'Бронювання', title: 'Виїзди за період', description: 'Виїзди гостей, запланований час, номер і статус бронювання.' },
    { id: 'in-house', category: 'Гості', title: 'Гості в готелі', description: 'Список активних проживань із контактами, номером і датою виїзду.' },
    { id: 'breakfasts', category: 'Ресторан', title: 'Сніданки', description: 'Кількість включених сніданків на день, видано та залишок по гостях.' },
    { id: 'payments', category: 'Фінанси', title: 'Оплати за період', description: 'Касові надходження за методом оплати, касою, гостем і бронюванням.' },
    { id: 'refunds', category: 'Фінанси', title: 'Повернення за період', description: 'Повернення коштів і вихідні касові операції за датою проведення.' },
    { id: 'accruals', category: 'Фінанси', title: 'Нарахування за послуги', description: 'Послуги та суми за датою надання, включно з нарахуваннями без рахунку.' },
    { id: 'occupancy', category: 'Номерний фонд', title: 'Завантаженість номерів', description: 'Зайняті та доступні номеро-ночі по днях з урахуванням ремонтів.' },
    { id: 'housekeeping', category: 'Операційні', title: 'Робота покоївок', description: 'Підготовлені завдання, тип прибирання, виконавець і статус.' },
    { id: 'repairs', category: 'Операційні', title: 'Ремонти та недоступні номери', description: 'Номери, статус недоступності, причина й період ремонту.' }
  ];

  readonly hotels = signal<HotelResponse[]>([]);
  readonly hotelId = signal<number | null>(null);
  readonly fromDate = signal(this.monthStart());
  readonly toDate = signal(this.localDate(new Date()));
  readonly selectedReportId = signal('manager');
  readonly format = signal<ReportDocumentFormat>('PDF');
  readonly previewWidth = signal(85);
  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  readonly loadingPreview = signal(false);
  readonly downloading = signal(false);
  readonly category = signal('Усі звіти');
  readonly search = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly fileName = signal('');
  readonly categories = computed(() => ['Усі звіти', ...new Set(this.reports.map(item => item.category))]);
  readonly filteredReports = computed(() => this.reports.filter(report =>
    (this.category() === 'Усі звіти' || report.category === this.category()) &&
    (!this.search().trim() || `${report.title} ${report.description}`.toLocaleLowerCase().includes(this.search().trim().toLocaleLowerCase()))
  ));
  readonly selectedReport = computed(() => this.reports.find(report => report.id === this.selectedReportId()) ?? this.reports[0]);
  private previewObjectUrl: string | null = null;
  private lastRequest: ReportDocumentRequest | null = null;

  ngOnInit(): void {
    this.loading.set(true);
    this.hotelApi.getAll().subscribe({
      next: hotels => { this.hotels.set(hotels ?? []); this.hotelId.set(hotels?.[0]?.id ?? null); this.loading.set(false); },
      error: error => this.fail(error)
    });
  }

  selectHotel(id: number | string): void { this.hotelId.set(Number(id)); this.invalidateDocument(); }
  changeFromDate(value: string): void { this.fromDate.set(value); this.invalidateDocument(); }
  changeToDate(value: string): void { this.toDate.set(value); this.invalidateDocument(); }

  generate(): void {
    const hotelId = this.hotelId();
    if (!hotelId) { this.error.set('Оберіть готель.'); return; }
    if (!this.fromDate() || !this.toDate() || this.fromDate() > this.toDate()) { this.error.set('Оберіть коректний період дат.'); return; }
    const days = this.daysBetween(this.fromDate(), this.toDate());
    if (days > 366) { this.error.set('Період звіту не може перевищувати 366 днів.'); return; }
    if (this.selectedReportId() === 'housekeeping' && days > 31) { this.error.set('Для звіту покоївок оберіть період до 31 дня.'); return; }

    const endExclusive = this.shiftDate(this.toDate(), 1);
    const from = `${this.fromDate()}T00:00:00`; const to = `${endExclusive}T00:00:00`;
    const selectedId = this.selectedReportId();
    this.invalidateDocument(); this.loading.set(true); this.error.set('');
    const needReservations = ['manager','bookings-created','cancellations','no-shows','arrivals','departures','in-house','breakfasts','occupancy'].includes(selectedId);
    const needRooms = ['manager','occupancy'].includes(selectedId);
    const needRepairs = ['manager','occupancy','repairs'].includes(selectedId);
    const needFolios = ['manager','accruals'].includes(selectedId);
    const needCash = ['manager','payments','refunds'].includes(selectedId);
    const needPlans = selectedId === 'housekeeping';
    const dates = needPlans ? this.dateList() : [];
    const plans$ = dates.length ? forkJoin(dates.map(date => this.housekeepingApi.getPlan(hotelId, date).pipe(catchError(error => error?.status === 404 ? of(null) : throwError(() => error))))) : of([]);
    forkJoin({
      reservations: needReservations ? this.reservationApi.getAll() : of([]),
      rooms: needRooms ? this.roomApi.getAllByHotelId(hotelId) : of([]),
      repairs: needRepairs ? this.repairApi.getByHotelAndPeriod(hotelId, from, to) : of([]),
      folios: needFolios ? this.folioApi.getByHotelId(hotelId) : of([]),
      unassigned: needFolios ? this.accrualApi.getUnassignedByHotelId(hotelId) : of([]),
      cash: needCash ? this.cashApi.report(hotelId, from, to) : of({ operations: [], totalsByLegalEntity: [] }),
      plans: plans$
    }).subscribe({
      next: data => {
        const reservations = data.reservations.filter(reservation => reservation.room.hotelId === hotelId);
        const scoped = {
          reservations, rooms: data.rooms, repairs: data.repairs, folios: data.folios,
          accruals: [...data.folios.flatMap(folio => folio.accruals ?? []), ...data.unassigned],
          operations: data.cash.operations,
          plans: (data.plans ?? []).filter((plan): plan is HousekeepingPlanResponse => plan !== null)
        };
        if (selectedId === 'breakfasts') this.loadBreakfastReport(hotelId, reservations, scoped);
        else this.finishGeneration(this.makeReportRows(selectedId, scoped), selectedId);
      },
      error: error => this.fail(error)
    });
  }

  ngOnDestroy(): void { this.clearPreview(); }
  selectReport(id: string): void { this.selectedReportId.set(id); this.invalidateDocument(); }
  selectCategory(value: string): void { this.category.set(value); }
  formatDate(value: string | null): string { return value ? new Date(value).toLocaleString('uk-UA') : ''; }
  formatStatus(status: ReservationStatus): string {
    return ({ [ReservationStatus.RESERVED]: 'Підтверджено', [ReservationStatus.IN_HOUSE]: 'Проживає', [ReservationStatus.COMPLETED]: 'Завершено', [ReservationStatus.CANCELLED]: 'Скасовано', [ReservationStatus.NO_SHOW]: 'Не заїхав' } as Record<ReservationStatus, string>)[status] ?? status;
  }
  guest(reservation: ReservationResponse): string {
    return reservation.guestName || [reservation.primaryGuest?.lastName, reservation.primaryGuest?.firstName, reservation.primaryGuest?.middleName].filter(Boolean).join(' ') || '—';
  }
  taskLabel(type: string): string {
    return ({ TURNOVER: 'Зміна гостей', CHECKOUT: 'Виїзд', ARRIVAL: 'Підготовка до заїзду', VACANT_DIRTY: 'Вільний брудний', STAYOVER: 'Поточне прибирання' } as Record<string,string>)[type] ?? type;
  }
  taskStatusLabel(status: string): string {
    return ({ PENDING:'Очікує', IN_PROGRESS:'У роботі', CLEANED:'Прибрано', INSPECTED:'Перевірено', SKIPPED:'Пропущено' } as Record<string,string>)[status] ?? status;
  }
  print(): void {
    const imageUrl=this.previewObjectUrl; if(!imageUrl)return;
    const printWindow=window.open('','_blank');
    if(!printWindow){this.error.set('Дозвольте спливаюче вікно, щоб надрукувати звіт.');return;}
    printWindow.location.href=imageUrl;
    window.setTimeout(()=>{try{printWindow.focus();printWindow.print();}catch{/* The browser PDF viewer remains available for printing. */}},800);
  }
  download(): void {
    const request=this.lastRequest;if(!request||this.downloading())return;
    const format=this.format();const extension=format==='DOCX'?'docx':format==='XLSX'?'xlsx':'pdf';
    this.downloading.set(true);this.error.set('');
    this.reportDocumentApi.generate(request,format).subscribe({
      next: blob=>{const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`${this.safeFilename(this.selectedReport().title)}-${request.fromDate}-${request.toDate}.${extension}`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);this.downloading.set(false);this.notice.set('Файл звіту завантажено.');},
      error: error=>{this.downloading.set(false);this.fail(error);}
    });
  }

  private loadBreakfastReport(hotelId: number, reservations: ReservationResponse[], scoped: any): void {
    const active = reservations.filter(reservation => reservation.status !== ReservationStatus.CANCELLED && reservation.status !== ReservationStatus.NO_SHOW && this.overlaps(reservation.checkIn, reservation.checkOut));
    const requests = active.map(reservation => this.reservationApi.getIncludedBreakfasts(reservation.id).pipe(catchError(error => error?.status === 404 ? of([]) : throwError(() => error))));
    (requests.length ? forkJoin(requests) : of([])).subscribe({
      next: data => {
        const breakfasts = data.flat().filter(item => item.serviceDate >= this.fromDate() && item.serviceDate <= this.toDate());
        this.finishGeneration(this.makeReportRows('breakfasts', scoped, breakfasts), 'breakfasts');
      }, error: error => this.fail(error)
    });
  }

  private makeReportRows(id: string, data: any, breakfasts: ReservationIncludedBreakfastResponse[] = []): ReportRow[] {
    const reservations: ReservationResponse[] = data.reservations ?? [];
    const period = (value: string | null) => !!value && value.slice(0,10) >= this.fromDate() && value.slice(0,10) <= this.toDate();
    const reservationHeaders = ['Підтвердження','Номер','Гість','Телефон','Email','Заїзд','Виїзд','Статус','Джерело','Тариф'];
    const reservationRow = (r: ReservationResponse): ReportRow => [r.confirmationNumber,r.room.roomNumber,this.guest(r),r.guestPhone ?? '',r.guestEmail ?? '',this.formatDate(r.checkIn),this.formatDate(r.checkOut),this.formatStatus(r.status),r.bookingSource ?? r.sourceCompany?.fullName ?? '',r.rate.name];
    switch (id) {
      case 'bookings-created': return [['Створено','Підтвердження',...reservationHeaders.slice(1)], ...reservations.filter(r => period(r.createdAt)).map(r => [this.formatDate(r.createdAt), ...reservationRow(r)])];
      case 'cancellations': return [['Скасовано','Причина',...reservationHeaders], ...reservations.filter(r => period(r.cancelledAt)).map(r => [this.formatDate(r.cancelledAt),r.cancellationReason ?? '',...reservationRow(r)])];
      case 'no-shows': return [reservationHeaders, ...reservations.filter(r => r.status === ReservationStatus.NO_SHOW && period(r.checkIn)).map(reservationRow)];
      case 'arrivals': return [['Час заїзду','Фактичний заїзд',...reservationHeaders], ...reservations.filter(r => period(r.checkIn)).map(r => [this.formatDate(r.checkIn),this.formatDate(r.actualCheckIn),...reservationRow(r)])];
      case 'departures': return [['Час виїзду',...reservationHeaders], ...reservations.filter(r => period(r.checkOut)).map(r => [this.formatDate(r.checkOut),...reservationRow(r)])];
      case 'in-house': return [['Підтвердження','Номер','Гість','Телефон','Email','Заїзд','Виїзд','Дорослі','Діти'], ...reservations.filter(r => r.status === ReservationStatus.IN_HOUSE).map(r => [r.confirmationNumber,r.room.roomNumber,this.guest(r),r.guestPhone ?? '',r.guestEmail ?? '',this.formatDate(r.actualCheckIn ?? r.checkIn),this.formatDate(r.checkOut),r.adults,r.children])];
      case 'breakfasts': {
        const byReservation = new Map(reservations.map(r => [r.id,r]));
        return [['Дата','Номер','Гість','Підтвердження','Кількість включено','Видано','Залишок','Скасовано'], ...breakfasts.map(item => { const reservation=byReservation.get(item.reservationId); return [item.serviceDate,reservation?.room.roomNumber ?? '',reservation?this.guest(reservation):'',reservation?.confirmationNumber ?? '',item.quantity,item.servedQuantity,item.remainingQuantity,item.cancelled?'Так':'Ні']; })];
      }
      case 'payments':
      case 'refunds': {
        const types = id === 'payments' ? ['PAYMENT','SERVICE_IN'] : ['REFUND','SERVICE_OUT'];
        const ops: CashOperation[] = data.operations.filter((operation: CashOperation) => types.includes(operation.operationType));
        return [['Дата','Тип','Метод','Каса','Юридична особа','Бронювання','Гість / опис','Сума','Касир'], ...ops.map(op => [this.formatDate(op.operationDate),op.operationType,op.paymentMethod,op.cashRegisterName,op.legalEntityName,op.reservationNumber ?? '',op.description ?? '',op.amount,op.performedByEmail])];
      }
      case 'accruals': {
        const accruals: AccrualResponse[] = data.accruals.filter((item: AccrualResponse) => item.active && item.serviceDate >= this.fromDate() && item.serviceDate <= this.toDate());
        return [['Дата послуги','Послуга','Бронювання','ID рахунку','Кількість','Ціна','Сума','Включено в тариф'], ...accruals.map(a => [a.serviceDate,a.name,a.reservationId ?? '',a.folioId ?? '',a.quantity,a.unitPrice,a.amount,a.includedComponent?'Так':'Ні'])];
      }
      case 'occupancy': return this.occupancyRows(data);
      case 'housekeeping': {
        const tasks = data.plans.flatMap((plan: HousekeepingPlanResponse) => plan.tasks.map(task => [plan.serviceDate,task.roomNumber,this.taskLabel(task.taskType),`Покоївка ${task.attendantNumber}`,this.taskStatusLabel(task.status),`${task.estimatedMinutes} хв`,task.departureGuest ?? task.arrivalGuest ?? '',task.notes ?? '']));
        return [['Дата','Номер','Робота','Виконавець','Статус','Оцінка часу','Гість','Примітка'],...tasks];
      }
      case 'repairs': return [['Номер','Статус','Початок','Кінець','Причина','Стан'], ...data.repairs.map((repair: RoomUnavailabilityResponse) => [repair.roomNumber,repair.status,this.formatDate(repair.startAt),this.formatDate(repair.completedAt ?? repair.endAt),repair.reason,repair.completedAt?'Завершено':'Активний'])];
      case 'manager': {
        const rows = this.occupancyRows(data).slice(1);
        const selectedReservations = reservations.filter(r => period(r.createdAt));
        const cancellations = reservations.filter(r => period(r.cancelledAt));
        const arrivals = reservations.filter(r => period(r.checkIn)); const departures = reservations.filter(r => period(r.checkOut));
        const totalAccrual = data.accruals.filter((a: AccrualResponse) => a.active && a.serviceDate >= this.fromDate() && a.serviceDate <= this.toDate()).reduce((sum: number,a: AccrualResponse) => sum+a.amount,0);
        const payments = data.operations.filter((op: CashOperation) => ['PAYMENT','SERVICE_IN'].includes(op.operationType)).reduce((sum: number,op: CashOperation)=>sum+op.amount,0);
        const refunds = data.operations.filter((op: CashOperation) => ['REFUND','SERVICE_OUT'].includes(op.operationType)).reduce((sum: number,op: CashOperation)=>sum+op.amount,0);
        return [['Показник','Значення'],['Період',`${this.fromDate()} — ${this.toDate()}`],['Створено бронювань',selectedReservations.length],['Скасовано бронювань',cancellations.length],['Заїзди',arrivals.length],['Виїзди',departures.length],['Номерів у готелі',data.rooms.length],['Зайняті номеро-ночі',rows.reduce((sum,row)=>sum+Number(row[4]),0)],['Середня завантаженість',`${this.averageOccupancy(data).toFixed(1)}%`],['Нараховано за послуги',totalAccrual.toFixed(2)],['Оплати',payments.toFixed(2)],['Повернення',refunds.toFixed(2)],['Ремонти / недоступність',data.repairs.length]];
      }
      default: return [['Звіт'],['Немає даних']];
    }
  }

  private occupancyRows(data: any): ReportRow[] {
    const rows: ReportRow[] = [['Дата','Номерів у фонді','Недоступно через ремонт','Доступно','Зайнято','Завантаженість']];
    for (const date of this.dateList()) {
      const reservations: ReservationResponse[] = data.reservations.filter((r: ReservationResponse) => r.status !== ReservationStatus.CANCELLED && r.status !== ReservationStatus.NO_SHOW && r.checkIn.slice(0,10) <= date && r.checkOut.slice(0,10) > date);
      const occupied = new Set(reservations.map(r => r.room.id)).size;
      const unavailable = new Set(data.repairs.filter((r: RoomUnavailabilityResponse) => new Date(r.startAt) < new Date(`${this.shiftDate(date,1)}T00:00:00`) && new Date(r.completedAt ?? r.endAt) > new Date(`${date}T00:00:00`)).map((r:RoomUnavailabilityResponse)=>r.roomId)).size;
      const available = Math.max(0,data.rooms.length-unavailable);
      rows.push([date,data.rooms.length,unavailable,available,occupied,`${available?Math.min(100,occupied/available*100).toFixed(1):0}%`]);
    }
    return rows;
  }

  private averageOccupancy(data: any): number {
    const table=this.occupancyRows(data).slice(1); const available=table.reduce((sum,row)=>sum+Number(row[3]),0); const occupied=table.reduce((sum,row)=>sum+Number(row[4]),0);
    return available?Math.min(100,occupied/available*100):0;
  }

  private finishGeneration(rows: ReportRow[], id: string): void {
    const hotelId=this.hotelId();const hotel=this.hotels().find(item=>item.id===hotelId);const title=this.reports.find(report=>report.id===id)?.title??'Звіт';
    if(!hotelId||!hotel||!rows.length){this.loading.set(false);this.error.set('Немає даних для формування звіту.');return;}
    const request={hotelId,hotelName:hotel.hotelName,title,fromDate:this.fromDate(),toDate:this.toDate(),columns:rows[0].map(value=>String(value??'')),rows:rows.slice(1).map(row=>row.map(value=>String(value??'')))};
    this.clearPreview();this.lastRequest=request;this.loading.set(false);this.error.set('');this.notice.set('Формуємо попередній перегляд…');this.loadingPreview.set(true);
    this.reportDocumentApi.preview(request).subscribe({
      next: blob=>{this.previewObjectUrl=URL.createObjectURL(blob);this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl));this.loadingPreview.set(false);this.fileName.set(title);this.notice.set('Попередній перегляд готовий. Оберіть формат і завантажте файл.');},
      error: error=>{this.loadingPreview.set(false);this.fail(error);}
    });
  }

  private invalidateDocument():void {this.clearPreview();this.fileName.set('');this.notice.set('');}
  private clearPreview():void {if(this.previewObjectUrl)URL.revokeObjectURL(this.previewObjectUrl);this.previewObjectUrl=null;this.previewUrl.set(null);this.lastRequest=null;this.loadingPreview.set(false);}

  private overlaps(checkIn: string, checkOut: string): boolean { return checkIn.slice(0,10) <= this.toDate() && checkOut.slice(0,10) > this.fromDate(); }
  private dateList(): string[] { const dates:string[]=[]; const day=new Date(`${this.fromDate()}T12:00:00`); const end=new Date(`${this.toDate()}T12:00:00`); while(day<=end&&dates.length<366){dates.push(this.localDate(day));day.setDate(day.getDate()+1);} return dates; }
  private daysBetween(from:string,to:string):number { return Math.floor((new Date(`${to}T12:00:00`).getTime()-new Date(`${from}T12:00:00`).getTime())/86400000)+1; }
  private safeFilename(value:string):string { return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/(^-|-$)/g,'')||'hotel-report'; }
  private shiftDate(value:string,amount:number):string { const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+amount);return this.localDate(date); }
  private localDate(date:Date):string { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  private monthStart():string { const date=new Date();return this.localDate(new Date(date.getFullYear(),date.getMonth(),1,12)); }
  private fail(error:any):void { this.loading.set(false);this.error.set(error?.error?.message??error?.message??'Не вдалося сформувати звіт. Перевірте підключення до сервера.'); }
}
