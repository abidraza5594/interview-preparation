import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private darkMode = new BehaviorSubject<boolean>(false);
  darkMode$ = this.darkMode.asObservable();

  constructor() {
    // Check if user has previously set a theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.setDarkMode(savedTheme === 'dark');
    } else {
      // Check if user prefers dark mode at OS level
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setDarkMode(prefersDark);
    }

    // Listen for changes in OS theme preference
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('theme')) {
        this.setDarkMode(e.matches);
      }
    });
    
    // Initialize CSS variables
    this.updateCSSVariables(this.darkMode.value);
  }

  setDarkMode(isDark: boolean): void {
    this.darkMode.next(isDark);
    
    if (isDark) {
      document.body.classList.add('dark-mode');
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
    
    this.updateCSSVariables(isDark);
  }

  toggleDarkMode(): void {
    this.setDarkMode(!this.darkMode.value);
  }

  isDarkMode(): boolean {
    return this.darkMode.value;
  }

  // Update CSS variables for proper theming
  private updateCSSVariables(isDark: boolean): void {
    const root = document.documentElement;
    
    if (isDark) {
      // Dark theme variables
      root.style.setProperty('--bg-light', '#1e1e1e');
      root.style.setProperty('--bg-dark', '#121212');
      root.style.setProperty('--text-color', '#e0e0e0');
      root.style.setProperty('--text-color-dark', '#e0e0e0');
      root.style.setProperty('--bg-light-rgb', '30, 30, 30');
      root.style.setProperty('--bg-dark-rgb', '18, 18, 18');
      root.style.setProperty('--primary-rgb', '46, 204, 113');
    } else {
      // Light theme variables
      root.style.setProperty('--bg-light', '#f8f9fa');
      root.style.setProperty('--bg-dark', '#ffffff');
      root.style.setProperty('--text-color', '#212529');
      root.style.setProperty('--text-color-dark', '#212529');
      root.style.setProperty('--bg-light-rgb', '248, 249, 250');
      root.style.setProperty('--bg-dark-rgb', '255, 255, 255');
      root.style.setProperty('--primary-rgb', '46, 204, 113');
    }
  }
} 