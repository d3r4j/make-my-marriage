import { Routes } from '@angular/router';

const page = () =>
  import('../../shared/components/scaffold-page/scaffold-page.component').then(
    (module) => module.ScaffoldPageComponent,
  );

export const PUBLIC_WEDDING_ROUTES: Routes = [
  {
    path: 'w/:slug',
    children: [
      { path: '', pathMatch: 'full', loadComponent: page, data: { title: 'Public wedding website scaffold' } },
      { path: 'invitation', loadComponent: page, data: { title: 'Invitation scaffold' } },
      { path: 'rsvp', loadComponent: page, data: { title: 'RSVP scaffold' } },
      { path: 'gallery', loadComponent: page, data: { title: 'Public gallery scaffold' } },
      { path: 'upload', loadComponent: page, data: { title: 'Guest upload scaffold' } },
      { path: 'live', loadComponent: page, data: { title: 'Live stream scaffold' } },
    ],
  },
];
