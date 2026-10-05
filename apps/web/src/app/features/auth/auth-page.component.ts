import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, of, switchMap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

type AuthView = 'signin' | 'register' | 'forgot' | 'reset' | 'check-email' | 'verify-success' | 'verify-error';
type ApiErrorBody = { error?: { code?: string; message?: string } };
interface AuthResponse {
  success: boolean;
  data?: {
    user?: { id: string; name: string; email: string };
    message?: string;
    weddings?: Array<{ id: string }>;
  };
}

@Component({
  selector: 'app-auth-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.css',
})
export class AuthPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected view: AuthView = 'signin';
  protected loading = false;
  protected resendLoading = false;
  protected showPassword = false;
  protected alert = '';
  protected alertKind: 'success' | 'error' | 'info' = 'info';
  protected verificationRequired = false;
  protected resendMessage = '';
  protected resendKind: 'success' | 'error' = 'success';
  protected name = '';
  protected email = '';
  protected password = '';
  protected newPassword = '';
  protected resetToken = '';
  protected verificationMessage = '';

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    const verificationToken = query.get('verify');
    const resetToken = query.get('reset');

    if (verificationToken) {
      this.loading = true;
      this.view = 'verify-success';
      this.verificationMessage = 'We are checking your verification link.';
      void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      this.http.get<AuthResponse>(`${environment.apiBaseUrl}/auth/verify-email`, {
        params: { token: verificationToken },
      }).pipe(
        timeout(30000),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => { this.loading = false; }),
      ).subscribe({
        next: () => {
          this.view = 'verify-success';
          this.verificationMessage = 'Your account is ready.';
        },
        error: (error: unknown) => {
          const code = this.errorCode(error);
          if (code === 'AUTH_VERIFICATION_TOKEN_USED') {
            this.view = 'verify-success';
            this.verificationMessage = 'This email has already been verified. Your account is ready.';
            return;
          }
          this.view = 'verify-error';
          this.verificationMessage = code === 'AUTH_VERIFICATION_TOKEN_INVALID'
            ? 'This verification link is invalid or has expired. Sign in and request a new link.'
            : this.errorMessage(error);
        },
      });
    } else if (resetToken) {
      this.resetToken = resetToken;
      this.view = 'reset';
      void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
  }

  protected switchView(view: AuthView): void {
    if (this.loading || this.resendLoading) return;
    this.view = view;
    this.alert = '';
    this.verificationRequired = false;
    this.resendMessage = '';
    this.showPassword = false;
  }

  protected continueToSignIn(): void {
    const kind = this.view === 'verify-error' ? 'error' : 'success';
    this.view = 'signin';
    this.verificationRequired = false;
    this.showAlert(this.verificationMessage, kind);
  }

  protected signIn(): void {
    if (this.loading) return;
    this.loading = true;
    this.alert = '';
    this.verificationRequired = false;
    this.http.post<AuthResponse>(`${environment.apiBaseUrl}/auth/login`, {
      email: this.email,
      password: this.password,
    }, { withCredentials: true }).pipe(
      switchMap(() => this.http.get<AuthResponse>(`${environment.apiBaseUrl}/weddings`, { withCredentials: true }).pipe(
        timeout(15000),
        catchError(() => of(null)),
      )),
      timeout(30000),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.loading = false; }),
    ).subscribe({
      next: (response) => void this.router.navigateByUrl(response?.data?.weddings?.length ? '/app/dashboard' : response ? '/app/welcome' : '/app/dashboard'),
      error: (error: unknown) => {
        if (this.errorCode(error) === 'AUTH_EMAIL_NOT_VERIFIED') {
          this.verificationRequired = true;
          this.showAlert('Verify your email address before signing in. We can send you a fresh verification link.', 'info');
          return;
        }
        this.showAlert(this.errorMessage(error), 'error');
      },
    });
  }

  protected register(): void {
    if (this.loading) return;
    this.loading = true;
    this.alert = '';
    this.http.post<AuthResponse>(`${environment.apiBaseUrl}/auth/register`, {
      name: this.name,
      email: this.email,
      password: this.password,
    }, { withCredentials: true }).pipe(
      timeout(30000),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.loading = false; }),
    ).subscribe({
      next: (response) => {
        this.email = response.data?.user?.email ?? this.email.trim().toLowerCase();
        this.password = '';
        this.resendMessage = '';
        this.view = 'check-email';
      },
      error: (error: unknown) => this.showAlert(this.errorMessage(error), 'error'),
    });
  }

  protected requestPasswordReset(): void {
    if (this.loading) return;
    this.loading = true;
    this.http.post<AuthResponse>(`${environment.apiBaseUrl}/auth/forgot-password`, { email: this.email }, {
      withCredentials: true,
    }).pipe(
      timeout(30000),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.loading = false; }),
    ).subscribe({
      next: (response) => this.showAlert(response.data?.message ?? 'If an account exists for that email, a reset link has been sent.', 'success'),
      error: (error: unknown) => this.showAlert(this.errorMessage(error), 'error'),
    });
  }

  protected resetPassword(): void {
    if (this.loading) return;
    this.loading = true;
    this.http.post<AuthResponse>(`${environment.apiBaseUrl}/auth/reset-password`, {
      token: this.resetToken,
      newPassword: this.newPassword,
    }, { withCredentials: true }).pipe(
      timeout(30000),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.loading = false; }),
    ).subscribe({
      next: (response) => {
        this.newPassword = '';
        this.view = 'signin';
        this.showAlert(response.data?.message ?? 'Password reset. You can sign in with your new password.', 'success');
        void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      },
      error: (error: unknown) => this.showAlert(this.errorMessage(error), 'error'),
    });
  }

  protected resendVerification(): void {
    if (this.loading || this.resendLoading || !this.email.trim()) return;
    this.resendLoading = true;
    this.resendMessage = '';
    this.http.post<AuthResponse>(`${environment.apiBaseUrl}/auth/resend-verification`, { email: this.email }, {
      withCredentials: true,
    }).pipe(
      timeout(30000),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.resendLoading = false; }),
    ).subscribe({
      next: (response) => {
        this.resendKind = 'success';
        this.resendMessage = response.data?.message ?? 'If that account needs verification, a new link has been sent.';
      },
      error: (error: unknown) => {
        this.resendKind = 'error';
        this.resendMessage = this.errorMessage(error);
      },
    });
  }

  private showAlert(message: string, kind: 'success' | 'error' | 'info'): void {
    this.alert = message;
    this.alertKind = kind;
  }

  private errorCode(error: unknown): string | undefined {
    if (!(error instanceof HttpErrorResponse)) return undefined;
    return (error.error as ApiErrorBody | undefined)?.error?.code;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = (error.error as ApiErrorBody | undefined)?.error?.message;
      if (message) return message;
    }
    if (error && typeof error === 'object' && 'name' in error && error.name === 'TimeoutError') {
      return 'This is taking longer than expected. Please try again.';
    }
    return 'We could not complete that request. Please try again.';
  }
}
