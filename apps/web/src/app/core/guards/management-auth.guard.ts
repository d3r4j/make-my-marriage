import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

export const managementAuthGuard: CanActivateFn = () => {
  const http = inject(HttpClient);
  const router = inject(Router);
  return http.get(`${environment.apiBaseUrl}/auth/me`, { withCredentials: true }).pipe(
    timeout(10000),
    map(() => true),
    catchError(() => of(router.createUrlTree(['/auth']))),
  );
};
