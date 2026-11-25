import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Nationality } from '../../core/models/enums/nationality.enum';
import { ProfileResponse } from '../../core/models/profile/profile-response.model';
import { ProfileService, SimilarProfilePair } from '../../core/services/profile.service';

@Component({
  selector: 'app-guests',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './guests.html',
  styleUrl: './guests.scss'
})
export class Guests implements OnInit {
  private readonly profileService = inject(ProfileService);
  readonly profiles = signal<ProfileResponse[]>([]);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly page = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly duplicateScan = signal(false);
  readonly duplicatesSearched = signal(false);
  readonly similarPairs = signal<SimilarProfilePair[]>([]);
  readonly nationalities = Object.values(Nationality);

  firstName = '';
  lastName = '';
  middleName = '';
  phone = '';
  email = '';
  dateOfBirth = '';
  nationality = '';
  vip = '';
  blacklisted = '';

  ngOnInit(): void { this.search(); }

  search(page = 0): void {
    this.loading.set(true);
    this.error.set('');
    const filters = {
      firstName: this.firstName.trim() || null,
      lastName: this.lastName.trim() || null,
      middleName: this.middleName.trim() || null,
      phone: this.phone.trim() || null,
      email: this.email.trim() || null,
      dateOfBirth: this.dateOfBirth || null,
      nationality: this.nationality || null,
      vip: this.vip === '' ? null : this.vip === 'true',
      blacklisted: this.blacklisted === '' ? null : this.blacklisted === 'true'
    };
    this.profileService.search(filters, page).subscribe({
      next: result => {
        this.profiles.set(result.content);
        this.page.set(result.page);
        this.totalPages.set(result.totalPages);
        this.totalElements.set(result.totalElements);
        this.loading.set(false);
      },
      error: error => {
        this.loading.set(false);
        this.error.set(error?.error?.message || 'Не вдалося завантажити профайли.');
      }
    });
  }

  findDuplicates(): void {
    this.duplicateScan.set(true);
    this.error.set('');
    this.profileService.findSimilar().subscribe({
      next: pairs => { this.similarPairs.set(pairs); this.duplicatesSearched.set(true); this.duplicateScan.set(false); },
      error: error => { this.duplicateScan.set(false); this.error.set(error?.error?.message || 'Не вдалося знайти схожі профайли.'); }
    });
  }

  merge(pair: SimilarProfilePair, keep: ProfileResponse, duplicate: ProfileResponse): void {
    const label = `${this.fullName(duplicate)} (#${duplicate.id})`;
    if (!window.confirm(`Об’єднати ${label} у профайл ${this.fullName(keep)} (#${keep.id})? Усі бронювання, документи та фінансові зв’язки буде перенесено.`)) return;
    this.loading.set(true);
    this.error.set('');
    this.profileService.merge(keep.id, duplicate.id).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(`Профайли об’єднано. Основний профайл: ${this.fullName(keep)} (#${keep.id}).`);
        this.similarPairs.update(items => items.filter(item => item !== pair));
        this.search(this.page());
      },
      error: error => { this.loading.set(false); this.error.set(error?.error?.message || 'Не вдалося об’єднати профайли.'); }
    });
  }

  fullName(profile: ProfileResponse): string {
    return [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ') || `Профайл №${profile.id}`;
  }

  pageNumbers(): number[] {
    const total = this.totalPages();
    const start = Math.max(0, Math.min(this.page() - 2, total - 5));
    return Array.from({ length: Math.min(5, total) }, (_, index) => start + index);
  }
}
