import { Routes } from '@angular/router';
import { MANAGEMENT_ROUTES } from './core/features/management.routes';
import { PUBLIC_WEDDING_ROUTES } from './core/features/public-wedding/public-wedding.routes';

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
      import('./shared/components/scaffold-page/scaffold-page.component').then(
        (module) => module.ScaffoldPageComponent,
      ),
    data: { title: 'Authentication scaffold' },
  },
  {
    path: 'app',
    children: MANAGEMENT_ROUTES,
  },
  ...PUBLIC_WEDDING_ROUTES,
  { path: '**', redirectTo: 'app' },
];
