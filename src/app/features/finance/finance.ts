import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { HotelResponse } from '../../core/models/hotel/hotel-response.model';
import { CashLegalEntityTotals, CashOperation, CashRegister, CashRegisterReport, CashShift } from '../../core/models/billing/cash-register.model';
import { CashRegisterService } from '../../core/services/cash-register.service';
import { HotelService } from '../../core/services/hotel.service';
import { LegalEntityService } from '../../core/services/legal-entity.service';
import { LegalEntityResponse } from '../../core/models/legal-entity-response.model';

@Component({
  selector: 'app-finance', standalone: true,
  imports: [FormsModule, CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './finance.html', styleUrl: './finance.scss'
})
export class Finance implements OnInit {
  private readonly hotelsApi = inject(HotelService);
  private readonly legalApi = inject(LegalEntityService);
  private readonly cashApi = inject(CashRegisterService);
  readonly hotels = signal<HotelResponse[]>([]);
  readonly legalEntities = signal<LegalEntityResponse[]>([]);
  readonly registers = signal<CashRegister[]>([]);
  readonly selectedHotelId = signal<number | null>(null);
  readonly selectedRegisterId = signal<number | null>(null);
  readonly shift = signal<CashShift | null>(null);
  readonly operations = signal<CashOperation[]>([]);
  readonly totals = signal<CashLegalEntityTotals[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly serviceModal = signal<'IN' | 'OUT' | null>(null);
  readonly closeModal = signal(false);
  readonly xReportData = signal<CashRegisterReport | null>(null);
  openingBalance = 0;
  serviceAmount = 0;
  serviceDescription = '';
  closeActual = 0;
  fromDate = this.dateInput(new Date(Date.now() - 7 * 86400000));
  toDate = this.dateInput(new Date());
  reportMode = false;
  searchText = '';
  selectedLegalId = '';
  selectedType = '';
  selectedMethod = '';
  sortAscending = false;

  get filteredOperations(): CashOperation[] {
    const query=this.searchText.trim().toLocaleLowerCase('uk');
    return this.operations().filter(op=>(!this.selectedLegalId||op.legalEntityId===Number(this.selectedLegalId))&&(!this.selectedType||op.operationType===this.selectedType)&&(!this.selectedMethod||op.paymentMethod===this.selectedMethod)&&(!query||[op.legalEntityName,op.cashRegisterName,op.description??'',op.reservationNumber??'',op.performedByEmail,String(op.id),String(op.paymentId??'')].some(value=>value.toLocaleLowerCase('uk').includes(query)))).sort((a,b)=>this.sortAscending?a.operationDate.localeCompare(b.operationDate):b.operationDate.localeCompare(a.operationDate));
  }
  toggleSort(): void { this.sortAscending=!this.sortAscending; }

  ngOnInit(): void {
    this.hotelsApi.getAll().subscribe({ next: hotels => { this.hotels.set(hotels); const id = hotels[0]?.id ?? null; this.selectedHotelId.set(id); if (id) this.loadHotel(id); }, error: e => this.fail(e) });
  }
  selectHotel(value: string): void { const id = Number(value) || null; this.selectedHotelId.set(id); this.selectedRegisterId.set(null); this.shift.set(null); this.operations.set([]); if (id) this.loadHotel(id); }
  selectRegister(value: string): void { const id = Number(value) || null; this.selectedRegisterId.set(id); this.shift.set(null); this.operations.set([]); if (id) this.refreshShift(); }
  createRegister(legalEntityId: number): void {
    const legal = this.legalEntities().find(item => item.id === legalEntityId); const hotelId = this.selectedHotelId();
    if (!legal || !hotelId) return;
    this.run(this.cashApi.create(hotelId, legalEntityId, `Каса — ${legal.shortName}`), register => { this.notice.set('Касу створено. Відкрийте зміну для початку роботи.'); this.loadHotel(hotelId); this.selectedRegisterId.set(register.id); });
  }
  openShift(): void { const id=this.selectedRegisterId(); if(!id)return; this.run(this.cashApi.openShift(id,Number(this.openingBalance)), () => { this.notice.set('Зміну відкрито.'); this.refreshShift(); }); }
  openServiceModal(incoming:boolean):void { this.serviceAmount=0;this.serviceDescription='';this.serviceModal.set(incoming?'IN':'OUT'); }
  openCloseModal():void { this.closeActual=this.shift()?.currentCash??0;this.closeModal.set(true); }
  addService(incoming: boolean): void {
    const id=this.selectedRegisterId(), shift=this.shift();
    if(!id||!shift||!this.isValidPositiveAmount(this.serviceAmount))return;
    this.run(this.cashApi.serviceOperation(id,shift.id,incoming,Number(this.serviceAmount),this.serviceDescription.trim()), () => { this.notice.set(incoming?'Внесення зареєстровано.':'Видачу зареєстровано.'); this.serviceAmount=0; this.serviceDescription=''; this.serviceModal.set(null); this.refreshShift(); });
  }
  closeShift(): void { const id=this.selectedRegisterId(), shift=this.shift(); if(!id||!shift||!this.isValidNonNegativeAmount(this.closeActual))return; this.run(this.cashApi.closeShift(id,shift.id,Number(this.closeActual)), response => { this.notice.set(`Z-звіт сформовано. Різниця: ${this.money(response.shift.difference ?? 0)}.`); this.closeModal.set(false); this.shift.set(response.shift); this.cashApi.operations(id,shift.id).subscribe({next:ops=>this.operations.set(ops),error:e=>this.fail(e)}); }); }
  showXReport(): void { const id=this.selectedRegisterId(), shift=this.shift(); if(!id||!shift||shift.status!=='OPEN')return; this.run(this.cashApi.xReport(id,shift.id), result => { this.xReportData.set(result); this.notice.set('X-звіт сформовано. Зміну не закрито.'); }); }
  loadReport(): void { const hotel=this.selectedHotelId(); if(!hotel)return; const from=`${this.fromDate}T00:00:00`; const end=new Date(`${this.toDate}T00:00:00`);end.setDate(end.getDate()+1);const to=`${this.dateInput(end)}T00:00:00`; this.run(this.cashApi.report(hotel,from,to), data=>{this.operations.set(data.operations);this.totals.set(data.totalsByLegalEntity);this.reportMode=true;}); }
  showCurrentOperations(): void { this.reportMode=false; this.totals.set([]); this.refreshShift(); }
  private loadHotel(id:number):void {
    this.legalApi.getByHotelId(id).subscribe({next: list=>this.legalEntities.set(list.filter(item=>item.active)),error:e=>this.fail(e)});
    this.cashApi.list(id).subscribe({next:list=>{this.registers.set(list); if(!this.selectedRegisterId()&&list.length)this.selectedRegisterId.set(list[0].id); if(this.selectedRegisterId())this.refreshShift();},error:e=>this.fail(e)});
  }
  private refreshShift():void { const id=this.selectedRegisterId(); if(!id)return; this.cashApi.currentShift(id).subscribe({next:shift=>{this.shift.set(shift); if(shift)this.cashApi.operations(id,shift.id).subscribe({next:ops=>this.operations.set(ops),error:e=>this.fail(e)}); else this.operations.set([]);},error:e=>this.fail(e)}); }
  private run<T>(request:Observable<T>, done:(value:T)=>void):void { this.busy.set(true);this.error.set('');request.subscribe({next:value=>{this.busy.set(false);done(value);},error:e=>{this.busy.set(false);this.fail(e);}}); }
  private fail(error:unknown):void { const candidate=error as {error?:{message?:string};message?:string};this.error.set(candidate?.error?.message??candidate?.message??'Не вдалося виконати запит до касового журналу.'); }
  money(value:number):string{return new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH'}).format(value??0);}
  isValidPositiveAmount(value:number):boolean{return Number.isFinite(Number(value))&&Number(value)>0;}
  isValidNonNegativeAmount(value:number):boolean{return Number.isFinite(Number(value))&&Number(value)>=0;}
  typeLabel(type:string):string{return ({PAYMENT:'Оплата',REFUND:'Повернення',SERVICE_IN:'Службове внесення',SERVICE_OUT:'Службова видача'} as Record<string,string>)[type]??type;}
  methodLabel(method:string):string{return ({CASH:'Готівка',CARD:'Картка',BANK_TRANSFER:'Переказ'} as Record<string,string>)[method]??method;}
  private dateInput(date:Date):string{return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
}
