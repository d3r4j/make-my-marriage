import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ManagementHeaderComponent } from '../../shared/components/management-header/management-header.component';

interface WeddingsResponse {
  success: boolean;
  data?: { weddings?: Array<{ id: string; title: string; weddingDate: string }> };
}

@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, ManagementHeaderComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css',
})
export class DashboardPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);

  protected loading = true;
  protected error = '';
  protected weddings: Array<{ id: string; title: string; weddingDate: string }> = [];

  ngOnInit(): void {
    this.http.get<WeddingsResponse>(`${environment.apiBaseUrl}/weddings`, { withCredentials: true }).pipe(
      timeout(15000),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.loading = false;
        this.changeDetector.markForCheck();
      }),
    ).subscribe({
      next: (response) => {
        this.weddings = response.data?.weddings ?? [];
        if (!this.weddings.length) void this.router.navigateByUrl('/app/welcome', { replaceUrl: true });
      },
      error: () => { this.error = 'Your wedding workspace could not be loaded. Refresh to try again.'; },
    });
  }
}
