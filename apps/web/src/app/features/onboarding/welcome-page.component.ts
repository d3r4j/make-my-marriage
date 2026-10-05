import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, finalize, of, switchMap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ManagementHeaderComponent } from '../../shared/components/management-header/management-header.component';

interface WorkspaceResponse {
  success: boolean;
  data?: {
    user?: { name: string };
    weddings?: Array<{ id: string }>;
    wedding?: { id: string };
  };
  error?: { message?: string };
}

@Component({
  selector: 'app-welcome-page',
  imports: [FormsModule, ManagementHeaderComponent],
  templateUrl: './welcome-page.component.html',
  styleUrl: './welcome-page.component.css',
})
export class WelcomePageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);

  protected loading = true;
  protected ready = false;
  protected creating = false;
  protected error = '';
  protected name = '';
  protected firstPartner = '';
  protected secondPartner = '';
  protected weddingDate = '';
  protected locationName = '';
  protected locationAddress = '';
  protected venueName = '';
  protected venueAddress = '';

  ngOnInit(): void {
    this.loadWelcomeState();
  }

  protected retryLoad(): void {
    this.loadWelcomeState();
  }

  private loadWelcomeState(): void {
    this.loading = true;
    this.ready = false;
    this.error = '';
    this.http.get<WorkspaceResponse>(`${environment.apiBaseUrl}/auth/me`, { withCredentials: true }).pipe(
      switchMap((account) => {
        this.name = account.data?.user?.name ?? '';
        return this.http.get<WorkspaceResponse>(`${environment.apiBaseUrl}/weddings`, { withCredentials: true }).pipe(
          timeout(15000),
          catchError(() => of(null)),
        );
      }),
      timeout(15000),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.loading = false;
        this.changeDetector.markForCheck();
      }),
    ).subscribe({
      next: (response) => {
        if (!response) {
          this.error = 'We could not confirm your wedding workspace. Please try again.';
          return;
        }
        if (response.data?.weddings?.length) {
          void this.router.navigateByUrl('/app/dashboard', { replaceUrl: true });
          return;
        }
        this.ready = true;
      },
      error: () => { this.error = 'We could not load your account. Please try again.'; },
    });
  }

  protected createWedding(): void {
    if (this.creating) return;
    this.error = '';
    this.creating = true;
    this.http.post<WorkspaceResponse>(`${environment.apiBaseUrl}/weddings`, {
      brideName: this.firstPartner,
      groomName: this.secondPartner,
      weddingDate: this.weddingDate,
      location: { name: this.locationName, address: this.locationAddress },
      venue: { name: this.venueName, address: this.venueAddress },
    }, { withCredentials: true }).pipe(
      timeout(30000),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.creating = false;
        this.changeDetector.markForCheck();
      }),
    ).subscribe({
      next: () => void this.router.navigateByUrl('/app/dashboard'),
      error: (error: unknown) => { this.error = this.errorMessage(error); },
    });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = (error.error as WorkspaceResponse | undefined)?.error?.message;
      if (message) return message;
    }
    if (error && typeof error === 'object' && 'name' in error && error.name === 'TimeoutError') {
      return 'Wedding setup is taking longer than expected. Please try again.';
    }
    return 'We could not create your wedding workspace. Please check your details and try again.';
  }
}
