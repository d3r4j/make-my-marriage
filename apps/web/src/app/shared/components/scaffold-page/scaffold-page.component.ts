import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-scaffold-page',
  template: '<main><h1>{{ title }}</h1><p>Application foundation only.</p></main>',
})
export class ScaffoldPageComponent {
  protected readonly title = inject(ActivatedRoute).snapshot.data['title'] as string;
}
