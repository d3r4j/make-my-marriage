import { Routes } from '@angular/router';
import { MANAGEMENT_ROUTES } from './features/management.routes';
import { PUBLIC_WEDDING_ROUTES } from './features/public-wedding/public-wedding.routes';

export const routes: Routes = [
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
  { path: '', pathMatch: 'full', redirectTo: 'app' },
  { path: '**', redirectTo: 'app' },
];
