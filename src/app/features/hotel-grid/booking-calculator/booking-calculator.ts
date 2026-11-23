import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { RateService } from '../../../core/services/rate.service';
import { RoomCategoryService } from '../../../core/services/room-category.service';
import { FacilityService } from '../../../core/services/ facility.service';
import { FacilityPriceService } from '../../../core/services/facility-price.service';
import { RateResponse } from '../../../core/models/billing/rate-response.model';
import { FacilityResponse } from '../../../core/models/billing/facility-response.model';
import { FacilityPriceResponse } from '../../../core/models/billing/facility-price-response.model';
import { FacilityType } from '../../../core/models/enums/facility-type.enum';
import { TaxStatus } from '../../../core/models/enums/tax-status.enum';
import { RoomCategoryResponse } from '../../../core/models/hotel/room-category-response.model';

export interface BookingCalculatorHotel {
  id: number;
  name: string;
}

@Component({
  selector: 'app-booking-calculator',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './booking-calculator.html',
  styleUrl: './booking-calculator.scss'
})
export class BookingCalculator implements OnInit {
  @Input() hotels: BookingCalculatorHotel[] = [];
  @Output() closed = new EventEmitter<void>();

  private readonly router = inject(Router);
  private readonly categoryService = inject(RoomCategoryService);
  private readonly rateService = inject(RateService);
  private readonly facilityService = inject(FacilityService);
  private readonly facilityPriceService = inject(FacilityPriceService);

  readonly categories = signal<RoomCategoryResponse[]>([]);
  readonly rates = signal<RateResponse[]>([]);
  readonly facilities = signal<FacilityResponse[]>([]);
  readonly hotelId = signal<number | null>(null);
  readonly categoryId = signal<number | null>(null);
  readonly rateId = signal<number | null>(null);
  readonly taxStatus = signal<TaxStatus>(TaxStatus.RESIDENT);
  readonly checkInDate = signal(this.localDate(new Date()));
  readonly checkOutDate = signal(this.localDate(this.addDays(new Date(), 1)));
  readonly checkInTime = signal('14:00');
  readonly checkOutTime = signal('12:00');
  readonly guestCount = signal(1);
  readonly periodPickerOpen = signal(true);
  readonly calendarMonth = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly calendarDays = computed(() => {
    const month = this.calendarMonth();
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { date, iso: this.localDate(date), currentMonth: date.getMonth() === month.getMonth() };
    });
  });
  readonly periodLabel = computed(() => {
    const start = this.checkInDate();
    const end = this.checkOutDate();
    if (!start) return 'Оберіть дати проживання';
    return `${this.formatDisplayDate(start)} ${this.checkInTime()} — ${end ? `${this.formatDisplayDate(end)} ${this.checkOutTime()}` : 'оберіть виїзд'}`;
  });
  readonly timeHours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
  readonly timeMinutes = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'));
  readonly activeTimePicker = signal<'checkIn' | 'checkOut' | null>(null);
  readonly loading = signal(true);
  readonly facilitiesLoading = signal(false);
  readonly calculating = signal(false);
  readonly error = signal('');
  readonly estimate = signal<{ accommodation: number; touristTax: number; total: number; nights: number; currency: string; components: Array<{ name: string; amount: number }> } | null>(null);
  readonly taxStatuses = TaxStatus;

  readonly availableCategories = computed(() => this.categories().filter(category => category.hotelId === this.hotelId()));
  readonly availableRates = computed(() => this.rates().filter(rate => rate.active && rate.categoryId === this.categoryId()));
  readonly selectedCategory = computed(() => this.availableCategories().find(category => category.id === this.categoryId()) ?? null);
  readonly selectedRate = computed(() => this.availableRates().find(rate => rate.id === this.rateId()) ?? null);
  readonly taxStatusOptions = [
    { value: TaxStatus.RESIDENT, label: 'Резидент' },
    { value: TaxStatus.NON_RESIDENT, label: 'Нерезидент' },
    { value: TaxStatus.EXEMPT, label: 'Звільнений від збору' }
  ];
  dateSelection: 'checkIn' | 'checkOut' = 'checkIn';
  private hourPicked: 'checkIn' | 'checkOut' | null = null;
  private minutePicked: 'checkIn' | 'checkOut' | null = null;

  ngOnInit(): void {
    this.hotelId.set(this.hotels[0]?.id ?? null);
    forkJoin({ categories: this.categoryService.getAll(), rates: this.rateService.getAll() }).subscribe({
      next: data => {
        this.categories.set(data.categories ?? []);
        this.rates.set(data.rates ?? []);
        const firstCategory = this.availableCategories()[0];
        if (firstCategory) this.selectCategory(firstCategory.id);
        this.loading.set(false);
      },
      error: error => {
        this.error.set(error?.error?.message || 'Не вдалося завантажити категорії та тарифи.');
        this.loading.set(false);
      }
    });
    this.loadFacilities(this.hotelId());
  }

  selectHotel(value: number | string): void {
    const hotelId = Number(value);
    this.hotelId.set(Number.isInteger(hotelId) ? hotelId : null);
    this.categoryId.set(null);
    this.rateId.set(null);
    this.estimate.set(null);
    const firstCategory = this.availableCategories()[0];
    if (firstCategory) this.selectCategory(firstCategory.id);
    this.loadFacilities(this.hotelId());
  }

  selectCategory(value: number | string): void {
    const categoryId = Number(value);
    this.categoryId.set(Number.isInteger(categoryId) ? categoryId : null);
    this.rateId.set(this.availableRates()[0]?.id ?? null);
    this.estimate.set(null);
  }

  selectRate(value: number | string): void {
    const rateId = Number(value);
    this.rateId.set(Number.isInteger(rateId) ? rateId : null);
    this.estimate.set(null);
  }

  togglePeriodPicker(): void {
    if (!this.periodPickerOpen()) {
      const date = this.checkInDate() || this.checkOutDate();
      if (date) {
        const [year, month] = date.split('-').map(Number);
        this.calendarMonth.set(new Date(year, month - 1, 1));
      }
      this.dateSelection = 'checkIn';
    }
    this.periodPickerOpen.update(open => !open);
  }

  shiftCalendarMonth(offset: number): void {
    const month = this.calendarMonth();
    this.calendarMonth.set(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }

  selectDate(iso: string): void {
    if (this.dateSelection === 'checkIn') {
      this.checkInDate.set(iso);
      if (this.checkOutDate() && this.checkOutDate() < iso) this.checkOutDate.set('');
      this.dateSelection = 'checkOut';
    } else if (iso < this.checkInDate()) {
      this.checkInDate.set(iso);
      this.checkOutDate.set('');
      this.dateSelection = 'checkOut';
    } else {
      this.checkOutDate.set(iso);
      this.dateSelection = 'checkIn';
    }
    this.estimate.set(null);
  }

  chooseDateField(which: 'checkIn' | 'checkOut'): void {
    this.dateSelection = which;
  }

  isDateSelected(iso: string): boolean {
    return iso === this.checkInDate() || iso === this.checkOutDate();
  }

  isDateInRange(iso: string): boolean {
    const start = this.checkInDate();
    const end = this.checkOutDate();
    return Boolean(start && end && iso > start && iso < end);
  }

  toggleTimePicker(which: 'checkIn' | 'checkOut'): void {
    const next = this.activeTimePicker() === which ? null : which;
    this.activeTimePicker.set(next);
    this.hourPicked = null;
    this.minutePicked = null;
    if (next) {
      const [hour, minute] = this.getTime(which).split(':');
      window.setTimeout(() => {
        document.getElementById(`calc-time-${which}-hour-${hour}`)?.scrollIntoView({ block: 'center' });
        document.getElementById(`calc-time-${which}-minute-${minute}`)?.scrollIntoView({ block: 'center' });
      });
    }
  }

  selectTimePart(which: 'checkIn' | 'checkOut', part: 'hour' | 'minute', value: string): void {
    const [hour, minute] = this.getTime(which).split(':');
    const next = part === 'hour' ? `${value}:${minute}` : `${hour}:${value}`;
    if (which === 'checkIn') this.checkInTime.set(next);
    else this.checkOutTime.set(next);
    this.estimate.set(null);

    if (part === 'hour') {
      this.hourPicked = which;
      this.minutePicked = null;
      return;
    }
    if (this.hourPicked === which || (this.minutePicked === which && minute === value)) {
      this.activeTimePicker.set(null);
      this.hourPicked = null;
      this.minutePicked = null;
    } else {
      this.minutePicked = which;
    }
  }

  getTime(which: 'checkIn' | 'checkOut'): string {
    return which === 'checkIn' ? this.checkInTime() : this.checkOutTime();
  }

  updateTaxStatus(value: TaxStatus): void {
    this.taxStatus.set(value);
    this.estimate.set(null);
  }

  decreaseGuestCount(): void {
    this.guestCount.update(count => Math.max(1, count - 1));
    this.estimate.set(null);
  }

  increaseGuestCount(): void {
    this.guestCount.update(count => Math.min(20, count + 1));
    this.estimate.set(null);
  }

  close(): void {
    this.closed.emit();
  }

  calculate(): void {
    const checkIn = this.checkInDate();
    const checkOut = this.checkOutDate();
    const rate = this.selectedRate();
    const nights = this.getNights(checkIn, checkOut);
    const dateTimeOrderIsValid = checkOut > checkIn || (checkOut === checkIn && this.checkOutTime() > this.checkInTime());
    if (!rate || !this.selectedCategory() || !this.hotelId() || !dateTimeOrderIsValid || (this.taxStatus() !== TaxStatus.EXEMPT && this.facilitiesLoading())) {
      this.error.set('Вкажіть час виїзду пізніше за заїзд, категорію та тариф.');
      this.estimate.set(null);
      return;
    }

    const serviceDates = this.serviceDates(checkIn, checkOut);
    const taxFacility = this.taxStatus() === TaxStatus.EXEMPT
      ? null
      : this.facilities().find(facility => facility.active && facility.type === FacilityType.TOURIST_TAX && facility.taxStatus === this.taxStatus()) ?? null;
    if (nights > 0 && this.taxStatus() !== TaxStatus.EXEMPT && !taxFacility) {
      this.error.set('Для цього готелю не налаштовано туристичний збір для вибраного статусу.');
      this.estimate.set(null);
      return;
    }

    this.calculating.set(true);
    this.error.set('');
    this.estimate.set(null);
    forkJoin({
      rateQuote: this.rateService.getQuote(rate.id, checkIn, checkOut, this.guestCount(), 0),
      touristTaxPrices: taxFacility && serviceDates.length
        ? forkJoin(serviceDates.map(date => this.facilityPriceService.getPriceForDate(taxFacility.id, date)))
        : of([] as FacilityPriceResponse[])
    }).subscribe({
      next: prices => {
        const accommodation = this.roundMoney(Number(prices.rateQuote.total));
        const touristTax = this.roundMoney(prices.touristTaxPrices.reduce((sum, price) => sum + Number(price.price), 0) * this.guestCount());
        this.estimate.set({ accommodation, touristTax, total: this.roundMoney(accommodation + touristTax), nights, currency: rate.currency, components: prices.rateQuote.components.map(component => ({ name: component.name, amount: Number(component.amount) })) });
        this.calculating.set(false);
      },
      error: error => {
        this.error.set(error?.error?.message || 'Не вдалося отримати ціни на весь період. Перевірте налаштування тарифу та туристичного збору.');
        this.calculating.set(false);
      }
    });
  }

  book(): void {
    const category = this.selectedCategory();
    const rate = this.selectedRate();
    const estimate = this.estimate();
    if (!category || !rate || !estimate) return;
    void this.router.navigate(['/reservations/new'], {
      queryParams: {
        categoryId: category.id,
        rateId: rate.id,
        taxStatus: this.taxStatus(),
        adults: this.guestCount(),
        checkIn: `${this.checkInDate()}T${this.checkInTime()}`,
        checkOut: `${this.checkOutDate()}T${this.checkOutTime()}`
      }
    });
    this.close();
  }

  private loadFacilities(hotelId: number | null): void {
    this.facilities.set([]);
    this.facilitiesLoading.set(Boolean(hotelId));
    if (!hotelId) return;
    this.facilityService.getActiveByHotelId(hotelId).pipe(
      catchError(() => of([] as FacilityResponse[])),
      finalize(() => this.facilitiesLoading.set(false))
    ).subscribe(facilities => this.facilities.set(facilities ?? []));
  }

  private getNights(start: string, end: string): number {
    if (!start || !end) return 0;
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86_400_000);
  }

  private serviceDates(start: string, end: string): string[] {
    const [year, month, day] = start.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return Array.from({ length: this.getNights(start, end) }, () => {
      const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
      date.setUTCDate(date.getUTCDate() + 1);
      return value;
    });
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private formatDisplayDate(value: string): string {
    const [year, month, day] = value.split('-');
    return `${day}.${month}.${year}`;
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
