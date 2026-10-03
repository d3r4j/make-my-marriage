import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
})
export class LandingPageComponent {
  protected scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected switchTheme(themeKey: 'traditional' | 'modern' | 'minimal'): void {
    const canvas = document.getElementById('website-preview-canvas');
    const ornament = document.getElementById('theme-ornament');
    const badge = document.getElementById('theme-invitation-badge');
    const names = document.getElementById('theme-names');
    const primaryButton = document.getElementById('theme-action-primary');

    if (!canvas || !ornament || !badge || !names || !primaryButton) return;

    document.querySelectorAll('.theme-btn').forEach((button) => {
      button.className =
        'theme-btn px-4 py-2 rounded-md text-xs uppercase tracking-wider font-medium text-[#F7F3EC]/70 hover:text-[#F7F3EC] bg-white/5 border border-white/10 transition-all';
    });

    const activeButton = document.getElementById(`btn-theme-${themeKey}`);
    if (activeButton) {
      activeButton.className =
        'theme-btn px-4 py-2 rounded-md text-xs uppercase tracking-wider font-semibold bg-[#EFE9DF] text-wine transition-all';
    }

    if (themeKey === 'traditional') {
      canvas.style.backgroundColor = '#F7F3EC';
      ornament.className =
        'w-6 h-6 rotate-45 border border-champagne bg-wine mx-auto mb-5 transition-all';
      badge.textContent = "You're Invited";
      badge.className =
        'text-[11px] uppercase tracking-[0.3em] text-champagne font-semibold block mb-2';
      names.className = 'font-serif text-3xl sm:text-5xl font-normal text-espresso transition-all';
      primaryButton.className =
        'px-6 py-2.5 rounded-md bg-wine text-[#F7F3EC] text-xs font-semibold uppercase tracking-wider shadow-sm';
      return;
    }

    if (themeKey === 'modern') {
      canvas.style.backgroundColor = '#EFE9DF';
      ornament.className =
        'w-5 h-5 rounded-full border-2 border-wine bg-transparent mx-auto mb-5 transition-all';
      badge.textContent = 'Celebration of Love';
      badge.className =
        'text-[11px] uppercase tracking-[0.25em] text-wine font-semibold block mb-2';
      names.className =
        'font-sans font-bold text-3xl sm:text-4xl text-espresso tracking-tight transition-all';
      primaryButton.className =
        'px-6 py-2.5 rounded-md bg-espresso text-[#F7F3EC] text-xs font-semibold uppercase tracking-wider shadow-sm';
      return;
    }

    canvas.style.backgroundColor = '#FAF8F5';
    ornament.className = 'w-8 h-0.5 bg-champagne mx-auto mb-5 transition-all';
    badge.textContent = 'Together With Families';
    badge.className = 'text-[10px] uppercase tracking-[0.35em] text-taupe font-medium block mb-2';
    names.className =
      'font-serif italic text-3xl sm:text-5xl font-light text-espresso transition-all';
    primaryButton.className =
      'px-6 py-2.5 rounded-md bg-champagne text-espresso text-xs font-semibold uppercase tracking-wider shadow-sm';
  }

  protected toggleRsvpSim(): void {
    const badge = document.getElementById('rsvp-status-badge');
    const button = document.getElementById('rsvp-sim-btn');
    if (!badge || !button) return;

    const isConfirmed = badge.textContent?.startsWith('Confirmed') ?? false;
    if (isConfirmed) {
      badge.textContent = 'Pending';
      badge.className =
        'px-2.5 py-1 rounded bg-amber-100 text-amber-900 border border-amber-200 text-xs font-medium';
      button.textContent = 'Simulate Guest RSVP Confirmation →';
      return;
    }

    badge.textContent = 'Confirmed (4 Guests)';
    badge.className =
      'px-2.5 py-1 rounded bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-medium';
    button.textContent = 'Reset Simulation ←';
  }
}
