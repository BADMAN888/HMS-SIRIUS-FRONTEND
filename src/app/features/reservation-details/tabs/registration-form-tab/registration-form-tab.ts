import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ReservationService } from '../../../../core/services/reservation.service';

type RegistrationCardFormat = 'PDF' | 'DOCX' | 'XLSX';

@Component({
  imports: [],
  selector: 'app-registration-form-tab',
  styleUrl: './registration-form-tab.scss',
  templateUrl: './registration-form-tab.html',
})
export class RegistrationFormTab implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly reservationService = inject(ReservationService);

  readonly format = signal<RegistrationCardFormat>('PDF');
  readonly previewWidth = signal(80);
  readonly previewUrl = signal<string | null>(null);
  readonly loadingPreview = signal(true);
  readonly downloading = signal(false);
  readonly error = signal<string | null>(null);
  private previewObjectUrl: string | null = null;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      this.loadingPreview.set(false);
      this.error.set('Спочатку збережіть бронювання, щоб сформувати реєстраційну карту.');
      return;
    }
    this.reservationService.getRegistrationCardPreview(id).subscribe({
      next: blob => {
        this.previewObjectUrl = URL.createObjectURL(blob);
        this.previewUrl.set(this.previewObjectUrl);
        this.loadingPreview.set(false);
      },
      error: error => {
        this.loadingPreview.set(false);
        this.setError(error, 'Не вдалося завантажити перегляд реєстраційної карти.');
      }
    });
  }

  ngOnDestroy(): void {
    if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
  }

  download(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id <= 0 || this.downloading()) return;
    this.downloading.set(true);
    this.error.set(null);
    this.reservationService.getRegistrationCard(id, this.format()).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `registration-card-${id}.${this.format().toLowerCase()}`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.downloading.set(false);
      },
      error: error => {
        this.downloading.set(false);
        this.setError(error, 'Не вдалося завантажити реєстраційну карту.');
      }
    });
  }

  print(): void {
    if (!this.previewObjectUrl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.error.set('Дозвольте спливаюче вікно, щоб надрукувати документ.');
      return;
    }

    printWindow.document.title = 'Реєстраційна карта гостя';
    printWindow.document.body.style.margin = '0';
    const image = printWindow.document.createElement('img');
    image.alt = 'Реєстраційна карта гостя';
    image.style.width = '100%';
    image.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
    printWindow.onafterprint = () => printWindow.close();
    image.src = this.previewObjectUrl;
    printWindow.document.body.appendChild(image);
  }

  private setError(error: HttpErrorResponse, fallback: string): void {
    if (error.error instanceof Blob) {
      error.error.text().then(body => {
        try {
          this.error.set(JSON.parse(body).message ?? fallback);
        } catch {
          this.error.set(fallback);
        }
      });
      return;
    }
    this.error.set(error.error?.message ?? fallback);
  }
}
