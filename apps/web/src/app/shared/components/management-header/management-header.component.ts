import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, DestroyRef, inject, Input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-management-header',
  imports: [RouterLink],
  templateUrl: './management-header.component.html',
})
export class ManagementHeaderComponent {
  @Input() context = 'Your wedding workspace';

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);

  protected signingOut = false;
  protected error = '';

  protected signOut(): void {
    if (this.signingOut) return;
    this.signingOut = true;
    this.error = '';
    this.http.post(`${environment.apiBaseUrl}/auth/logout`, {}, { withCredentials: true }).pipe(
      timeout(15000),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.signingOut = false;
        this.changeDetector.markForCheck();
      }),
    ).subscribe({
      next: () => void this.router.navigateByUrl('/auth', { replaceUrl: true }),
      error: () => { this.error = 'Sign out failed. Please try again.'; },
    });
  }
}
