import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import { HotelService } from '../../core/services/hotel.service';
import { RoomCategoryService } from '../../core/services/room-category.service';
import { FacilityService } from '../../core/services/ facility.service';
import { FacilityPriceService } from '../../core/services/facility-price.service';
import { RateService } from '../../core/services/rate.service';
import { PriceService } from '../../core/services/price.service';
import { ServiceComponentService } from '../../core/services/service-component.service';
import { HotelResponse } from '../../core/models/hotel/hotel-response.model';
import { RoomCategoryResponse } from '../../core/models/hotel/room-category-response.model';
import { FacilityRequest } from '../../core/models/billing/facility-request.model';
import { FacilityResponse } from '../../core/models/billing/facility-response.model';
import { FacilityPriceRequest } from '../../core/models/billing/facility-price-request.model';
import { FacilityPriceResponse } from '../../core/models/billing/facility-price-response.model';
import { RateRequest } from '../../core/models/billing/rate-request.model';
import { RateResponse } from '../../core/models/billing/rate-response.model';
import { PriceRequest } from '../../core/models/billing/price-request.model';
import { PriceResponse } from '../../core/models/billing/price-response.model';
import { ServiceComponentRequest, ServiceComponentResponse } from '../../core/models/billing/service-component.model';
import { RateQuoteResponse } from '../../core/models/billing/rate-quote.model';
import { FacilityType } from '../../core/models/enums/facility-type.enum';
import { TaxStatus } from '../../core/models/enums/tax-status.enum';
import { ComponentPriceSource } from '../../core/models/enums/component-price-source.enum';
import { ComponentQuantityBasis } from '../../core/models/enums/component-quantity-basis.enum';

type Section = 'rates'|'facilities'|'price-list';
@Component({selector:'app-pricing-admin',standalone:true,imports:[FormsModule,DecimalPipe],templateUrl:'./pricing-admin.html',styleUrl:'./pricing-admin.scss'})
export class PricingAdmin implements OnInit {
  private readonly hotelApi=inject(HotelService); private readonly categoryApi=inject(RoomCategoryService); private readonly facilityApi=inject(FacilityService);
  private readonly facilityPriceApi=inject(FacilityPriceService); private readonly rateApi=inject(RateService); private readonly priceApi=inject(PriceService); private readonly componentApi=inject(ServiceComponentService);
  readonly section=signal<Section>('rates'); readonly hotels=signal<HotelResponse[]>([]); readonly hotelId=signal<number|null>(null); readonly categories=signal<RoomCategoryResponse[]>([]);
  readonly facilities=signal<FacilityResponse[]>([]); readonly rates=signal<RateResponse[]>([]); readonly busy=signal(false); readonly error=signal(''); readonly notice=signal('');
  readonly selectedRate=signal<RateResponse|null>(null); readonly selectedFacility=signal<FacilityResponse|null>(null); readonly ratePrices=signal<PriceResponse[]>([]); readonly facilityPrices=signal<FacilityPriceResponse[]>([]); readonly components=signal<ServiceComponentResponse[]>([]); readonly quote=signal<RateQuoteResponse|null>(null); readonly listPrices=signal<Record<number,FacilityPriceResponse|null>>({}); readonly dateHistory=signal<FacilityPriceResponse[]>([]);
  readonly facilityTypes=Object.values(FacilityType); readonly taxStatuses=Object.values(TaxStatus); readonly priceSources=Object.values(ComponentPriceSource); readonly quantityBases=Object.values(ComponentQuantityBasis);
  readonly today=new Date().toISOString().slice(0,10); readonly historyDate=signal(new Date().toISOString().slice(0,10)); readonly priceDate=signal(new Date().toISOString().slice(0,10)); readonly filterType=signal('');
  readonly emptyRate=():RateRequest=>({name:'',description:'',currency:'UAH',categoryId:0,active:true}); rateForm:RateRequest=this.emptyRate(); editingRate:number|null=null;
  facilityForm:FacilityRequest={hotelId:0,name:'',description:'',unit:'шт.',active:true,type:FacilityType.STANDARD,taxStatus:null}; editingFacility:number|null=null;
  priceForm:PriceRequest={rateId:0,price:0,validFrom:this.today,validTo:null}; facilityPriceForm:FacilityPriceRequest={facilityId:0,price:0,validFrom:this.today,validTo:null};
  componentForm:ServiceComponentRequest={rateId:null,parentFacilityId:null,facilityId:0,priceSource:ComponentPriceSource.FACILITY_PRICE,quantityBasis:ComponentQuantityBasis.FIXED,multiplier:1,included:false,sortOrder:0,active:true}; editingComponent:number|null=null;
  quoteForm={checkIn:this.today,checkOut:'',adults:2,children:0}; componentContext:'rate'|'facility'='rate';
  ngOnInit():void{this.busy.set(true);this.hotelApi.getAll().subscribe({next:h=>{this.hotels.set(h??[]);if(h?.length)this.selectHotel(h[0].id);else this.loadRates();},error:e=>this.fail(e)});}
  selectHotel(id:number):void{this.hotelId.set(Number(id));this.busy.set(true);forkJoin({categories:this.categoryApi.getAllByHotelId(Number(id)),facilities:this.facilityApi.getAllByHotelId(Number(id))}).subscribe({next:x=>{this.categories.set(x.categories??[]);this.facilities.set(x.facilities??[]);this.facilityForm={...this.facilityForm,hotelId:Number(id)};this.loadRates();this.loadPriceList();},error:e=>this.fail(e)});}
  private loadRates():void{this.rateApi.getAll().subscribe({next:r=>{const categoryIds=new Set(this.categories().map(c=>c.id));this.rates.set((r??[]).filter(rate=>categoryIds.has(rate.categoryId)));this.busy.set(false);},error:e=>this.fail(e)});}
  setSection(v:Section):void{this.section.set(v);this.notice.set('');this.error.set('');if(v==='price-list')this.loadPriceList();}
  categoryName(id:number):string{return this.categories().find(c=>c.id===id)?.name??`Категорія ${id}`;}
  get componentFacilities():FacilityResponse[]{return this.facilities().filter(f=>f.active&&f.type!==FacilityType.TOURIST_TAX);}
  get showTaxStatus():boolean{return this.facilityForm.type===FacilityType.TOURIST_TAX;}
  saveRate():void{if(!this.rateForm.name.trim()||this.rateForm.categoryId<=0||this.rateForm.currency.trim().length!==3)return;const op=this.editingRate?this.rateApi.update(this.editingRate,this.rateForm):this.rateApi.create(this.rateForm);this.run(op,()=>{this.editingRate=null;this.rateForm=this.emptyRate();this.loadRates();this.notice.set('Тариф збережено.');});}
  editRate(r:RateResponse):void{this.editingRate=r.id;this.rateForm={name:r.name,description:r.description,currency:r.currency,categoryId:r.categoryId,active:r.active};}
  deleteRate(r:RateResponse):void{if(!confirm(`Видалити тариф «${r.name}»?`))return;this.run(this.rateApi.delete(r.id),()=>{this.loadRates();this.notice.set('Тариф видалено.');});}
  openRate(r:RateResponse):void{this.selectedRate.set(r);this.priceForm={rateId:r.id,price:0,validFrom:this.today,validTo:null};this.componentContext='rate';this.openRateComponents();this.quote.set(null);forkJoin({prices:this.priceApi.getHistory(r.id),components:this.componentApi.getByRate(r.id)}).subscribe({next:x=>{this.ratePrices.set(x.prices??[]);this.components.set(x.components??[]);},error:e=>this.fail(e)});}
  addRatePrice():void{const r=this.selectedRate();if(!r||this.priceForm.price<=0||!this.priceForm.validFrom)return;this.run(this.priceApi.create({...this.priceForm,rateId:r.id}),()=>{this.priceApi.getHistory(r.id).subscribe({next:x=>this.ratePrices.set(x??[]),error:e=>this.fail(e)});this.notice.set('Ціну тарифу додано.');});}
  lookupRateDate():void{const r=this.selectedRate();if(!r||!this.historyDate())return;this.priceApi.getPriceForDate(r.id,this.historyDate()).subscribe({next:p=>this.notice.set(`Ціна на ${this.historyDate()}: ${p.price} ${r.currency}`),error:()=>this.notice.set(`Для тарифу немає ціни на ${this.historyDate()}.`)});}
  openRateComponents():void{const r=this.selectedRate();if(!r)return;this.componentContext='rate';this.componentForm={rateId:r.id,parentFacilityId:null,facilityId:0,priceSource:ComponentPriceSource.FACILITY_PRICE,quantityBasis:ComponentQuantityBasis.FIXED,multiplier:1,included:false,sortOrder:this.components().length,active:true};this.editingComponent=null;}
  openFacility(f:FacilityResponse):void{this.selectedFacility.set(f);this.componentContext='facility';this.facilityPriceForm={facilityId:f.id,price:0,validFrom:this.today,validTo:null};this.componentForm={rateId:null,parentFacilityId:f.id,facilityId:0,priceSource:ComponentPriceSource.FACILITY_PRICE,quantityBasis:ComponentQuantityBasis.FIXED,multiplier:1,included:false,sortOrder:0,active:true};forkJoin({prices:this.facilityPriceApi.getHistory(f.id),components:this.componentApi.getByFacility(f.id)}).subscribe({next:x=>{this.facilityPrices.set(x.prices??[]);this.components.set(x.components??[]);},error:e=>this.fail(e)});}
  saveFacility():void{const h=this.hotelId();if(!h||!this.facilityForm.name.trim()||!this.facilityForm.unit.trim())return;const req={...this.facilityForm,hotelId:h,taxStatus:this.facilityForm.type===FacilityType.TOURIST_TAX?this.facilityForm.taxStatus:null};if(req.type===FacilityType.TOURIST_TAX&&!req.taxStatus){this.error.set('Для туристичного збору виберіть податковий статус.');return;}const op=this.editingFacility?this.facilityApi.update(this.editingFacility,req):this.facilityApi.create(req);this.run(op,()=>{this.editingFacility=null;this.facilityForm={hotelId:h,name:'',description:'',unit:'шт.',active:true,type:FacilityType.STANDARD,taxStatus:null};this.reloadFacilities();this.notice.set('Послугу збережено.');});}
  editFacility(f:FacilityResponse):void{this.editingFacility=f.id;this.facilityForm={hotelId:f.hotelId,name:f.name,description:f.description,unit:f.unit,active:f.active,type:f.type,taxStatus:f.taxStatus};}
  deactivateFacility(f:FacilityResponse):void{if(!confirm(`Деактивувати «${f.name}»?`))return;this.run(this.facilityApi.deactivate(f.id),()=>{this.reloadFacilities();this.notice.set('Послугу деактивовано; історію цін збережено.');});}
  addFacilityPrice():void{const f=this.selectedFacility();if(!f||this.facilityPriceForm.price<=0)return;this.run(this.facilityPriceApi.create({...this.facilityPriceForm,facilityId:f.id}),()=>{this.facilityPriceApi.getHistory(f.id).subscribe({next:x=>this.facilityPrices.set(x??[]),error:e=>this.fail(e)});this.loadPriceList();this.notice.set('Ціну послуги додано.');});}
  lookupFacilityDate():void{const f=this.selectedFacility();if(!f)return;this.facilityPriceApi.getPriceForDate(f.id,this.historyDate()).subscribe({next:p=>this.notice.set(`Ціна на ${this.historyDate()}: ${p.price}`),error:()=>this.notice.set(`Для цієї послуги немає ціни на ${this.historyDate()}.`)});}
  createComponent():void{const f=this.componentForm.facilityId;if(!f)return;const op=this.editingComponent?this.componentApi.update(this.editingComponent,this.componentForm):this.componentApi.create(this.componentForm);this.run(op,()=>{this.editingComponent=null;this.refreshComponents();this.notice.set('Складову збережено.');});}
  editComponent(c:ServiceComponentResponse):void{this.editingComponent=c.id;this.componentForm={rateId:c.rateId,parentFacilityId:c.parentFacilityId,facilityId:c.facilityId,priceSource:c.priceSource,quantityBasis:c.quantityBasis,multiplier:c.multiplier,included:c.included,sortOrder:c.sortOrder,active:c.active};}
  removeComponent(c:ServiceComponentResponse):void{if(!confirm(`Деактивувати складову «${c.facilityName}»?`))return;this.run(this.componentApi.deactivate(c.id),()=>{this.refreshComponents();this.notice.set('Складову деактивовано.');});}
  private refreshComponents():void{const r=this.selectedRate(),f=this.selectedFacility();const request=this.componentContext==='rate'&&r?this.componentApi.getByRate(r.id):f?this.componentApi.getByFacility(f.id):null;request?.subscribe({next:x=>this.components.set(x??[]),error:e=>this.fail(e)});}
  quoteRate():void{const r=this.selectedRate();if(!r||!this.quoteForm.checkIn||!this.quoteForm.checkOut)return;this.rateApi.getQuote(r.id,this.quoteForm.checkIn,this.quoteForm.checkOut,this.quoteForm.adults,this.quoteForm.children).subscribe({next:q=>this.quote.set(q),error:e=>this.fail(e)});}
  cancelFacility():void{this.editingFacility=null;this.facilityForm={hotelId:this.hotelId()??0,name:'',description:'',unit:'шт.',active:true,type:FacilityType.STANDARD,taxStatus:null};}
  private reloadFacilities():void{const h=this.hotelId();if(h)this.facilityApi.getAllByHotelId(h).subscribe({next:x=>{this.facilities.set(x??[]);this.loadPriceList();},error:e=>this.fail(e)});}
  private loadPriceList():void{this.listPrices.set({});const active=this.facilities().filter(f=>f.active);if(!active.length)return;forkJoin(active.map(f=>this.facilityPriceApi.getPriceForDate(f.id,this.priceDate()).pipe(catchError(()=>of(null))))).subscribe(prices=>{const map:Record<number,FacilityPriceResponse|null>={};active.forEach((f,i)=>map[f.id]=prices[i]);this.listPrices.set(map);});}
  get priceListFacilities():FacilityResponse[]{return this.facilities().filter(f=>f.active&&(!this.filterType()||f.type===this.filterType()));}
  lookupPriceListDate():void{this.loadPriceList();}
  showHistory(f:FacilityResponse):void{this.selectedFacility.set(f);this.historyDate.set(this.priceDate());this.facilityPriceApi.getHistory(f.id).subscribe({next:x=>this.dateHistory.set(x??[]),error:e=>this.fail(e)});}
  private run<T>(source:import('rxjs').Observable<T>,done:(v:T)=>void):void{this.busy.set(true);this.error.set('');source.subscribe({next:v=>{this.busy.set(false);done(v);},error:e=>this.fail(e)});}
  private fail(e:unknown):void{this.busy.set(false);const x=e as {error?:{message?:string}};this.error.set(x?.error?.message??'Операція не вдалася. Перевірте поля та правила backend.');}
}
