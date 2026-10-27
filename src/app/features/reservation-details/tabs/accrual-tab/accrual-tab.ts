import { Component, input } from '@angular/core';

@Component({
  selector: 'app-accrual-tab',
  standalone: true,
  templateUrl: './accrual-tab.html',
  styleUrl: './accrual-tab.scss'
})
export class AccrualTab {
  readonly reservation = input<unknown | null>(null);
}
