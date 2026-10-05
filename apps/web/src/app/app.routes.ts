import { Routes } from '@angular/router';
import { MANAGEMENT_ROUTES } from './core/features/management.routes';
import { PUBLIC_WEDDING_ROUTES } from './core/features/public-wedding/public-wedding.routes';
import { managementAuthGuard } from './core/guards/management-auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/marketing/landing-page/landing-page.component').then(
        (module) => module.LandingPageComponent,
      ),
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('./features/auth/auth-page.component').then((module) => module.AuthPageComponent),
  },
  {
    path: 'app',
    canActivate: [managementAuthGuard],
    children: MANAGEMENT_ROUTES,
  },
  ...PUBLIC_WEDDING_ROUTES,
  { path: '**', redirectTo: 'app' },
];
