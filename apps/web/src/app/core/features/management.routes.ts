import { Routes } from '@angular/router';

const page = () =>
  import('../../shared/components/scaffold-page/scaffold-page.component').then(
    (module) => module.ScaffoldPageComponent,
  );

export const MANAGEMENT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'welcome',
    loadComponent: () => import('../../features/onboarding/welcome-page.component').then((module) => module.WelcomePageComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('../../features/onboarding/dashboard-page.component').then((module) => module.DashboardPageComponent),
  },
  { path: 'vendor-discovery', loadComponent: page, data: { title: 'Vendor discovery scaffold' } },
  {
    path: 'wedding',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'settings' },
      { path: 'settings', loadComponent: page, data: { title: 'Wedding settings scaffold' } },
      { path: 'functions', loadComponent: page, data: { title: 'Functions scaffold' } },
      { path: 'tasks', loadComponent: page, data: { title: 'Tasks scaffold' } },
      { path: 'guests', loadComponent: page, data: { title: 'Guests scaffold' } },
      { path: 'expenses', loadComponent: page, data: { title: 'Expenses scaffold' } },
      { path: 'vendors', loadComponent: page, data: { title: 'Vendors scaffold' } },
      { path: 'gallery', loadComponent: page, data: { title: 'Gallery scaffold' } },
      { path: 'members', loadComponent: page, data: { title: 'Members scaffold' } },
      { path: 'website', loadComponent: page, data: { title: 'Website builder scaffold' } },
    ],
  },
];
