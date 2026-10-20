
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReservationService } from '../../../core/services/reservation.service';
import { ReservationResponse } from '../../../core/models/reservation/reservation-response.model';
import { ReservationCommentResponse } from '../../../core/models/reservation/reservation-comment-response.model';
import { ReservationStatus } from '../../../core/models/enums/reservation-status.enum';
import { ReservationComment } from '../../../core/models/reservation/reservation-comment.model';

@Component({
  selector: 'app-reservation-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reservation-details.html',
  styleUrl: './reservation-details.scss'
})
export class ReservationDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reservationService = inject(ReservationService);

  readonly reservation = signal<ReservationResponse | null>(null);
  readonly comments = signal<ReservationCommentResponse[]>([]);
  readonly isLoading = signal(true);
  readonly isActionPending = signal(false);
  readonly isCommentPending = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly newCommentText = signal('');

  readonly Status = ReservationStatus;

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = Number(idParam);

    if (!idParam || !Number.isSafeInteger(id) || id <= 0) {
      this.errorMessage.set('Некоректний ідентифікатор бронювання.');
      this.isLoading.set(false);
      return;
    }

    this.loadReservationData(id);
  }

  loadReservationData(id: number): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.reservationService.getById(id).subscribe({
      next: (reservation) => {
        this.reservation.set(reservation);
        this.isLoading.set(false);
        this.loadComments(id);
      },
      error: (error: unknown) => {
        console.error('Error fetching reservation:', error);
        this.reservation.set(null);
        this.errorMessage.set(
          'Не вдалося завантажити деталі бронювання.'
        );
        this.isLoading.set(false);
      }
    });
  }

  loadComments(reservationId: number): void {
    this.reservationService.getComments(reservationId).subscribe({
      next: (comments) => this.comments.set(comments),
      error: (error: unknown) => {
        console.error('Error fetching comments:', error);
      }
    });
  }

  onCheckIn(): void {
    const reservation = this.reservation();

    if (!reservation || this.isActionPending()) {
      return;
    }

    this.isActionPending.set(true);

    this.reservationService.checkIn(reservation.id).subscribe({
      next: () => this.refreshData(reservation.id),
      error: (error: unknown) =>
        this.handleActionError('Не вдалося виконати Check-In.', error)
    });
  }

  onCheckOut(): void {
    const reservation = this.reservation();

    if (!reservation || this.isActionPending()) {
      return;
    }

    this.isActionPending.set(true);

    this.reservationService.checkOut(reservation.id).subscribe({
      next: () => this.refreshData(reservation.id),
      error: (error: unknown) =>
        this.handleActionError('Не вдалося виконати Check-Out.', error)
    });
  }

  onCancel(): void {
    const reservation = this.reservation();

    if (
      !reservation ||
      this.isActionPending() ||
      !confirm('Ви впевнені, що хочете скасувати це бронювання?')
    ) {
      return;
    }

    this.isActionPending.set(true);

    this.reservationService.cancel(reservation.id).subscribe({
      next: () => this.refreshData(reservation.id),
      error: (error: unknown) =>
        this.handleActionError('Не вдалося скасувати бронювання.', error)
    });
  }

  onNoShow(): void {
    const reservation = this.reservation();

    if (
      !reservation ||
      this.isActionPending() ||
      !confirm('Позначити бронювання як No-Show?')
    ) {
      return;
    }

    this.isActionPending.set(true);

    this.reservationService.noShow(reservation.id).subscribe({
      next: () => this.refreshData(reservation.id),
      error: (error: unknown) =>
        this.handleActionError('Не вдалося змінити статус на No-Show.', error)
    });
  }

  addComment(): void {
    const reservation = this.reservation();
    const text = this.newCommentText().trim();

    if (!reservation || !text || this.isCommentPending()) {
      return;
    }

    const request: ReservationComment = { text };

    this.isCommentPending.set(true);

    this.reservationService.createComment(reservation.id, request).subscribe({
      next: () => {
        this.newCommentText.set('');
        this.isCommentPending.set(false);
        this.loadComments(reservation.id);
      },
      error: (error: unknown) => {
        console.error('Error adding comment:', error);
        this.isCommentPending.set(false);
        alert('Не вдалося додати коментар.');
      }
    });
  }

  deleteComment(commentId: number): void {
    const reservation = this.reservation();

    if (
      !reservation ||
      this.isCommentPending() ||
      !confirm('Видалити коментар?')
    ) {
      return;
    }

    this.isCommentPending.set(true);

    this.reservationService
      .deleteComment(reservation.id, commentId)
      .subscribe({
        next: () => {
          this.isCommentPending.set(false);
          this.loadComments(reservation.id);
        },
        error: (error: unknown) => {
          console.error('Error deleting comment:', error);
          this.isCommentPending.set(false);
          alert('Не вдалося видалити коментар.');
        }
      });
  }

  close(): void {
    void this.router.navigate(['/hotel-grid']);
  }

  private refreshData(id: number): void {
    this.isActionPending.set(false);
    this.loadReservationData(id);
  }

  private handleActionError(message: string, error: unknown): void {
    console.error(error);
    this.isActionPending.set(false);
    alert(message);
  }
}
