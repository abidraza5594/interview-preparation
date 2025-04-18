import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MonacoEditorService {
  private monacoLoaded = new BehaviorSubject<boolean>(false);
  monacoLoaded$ = this.monacoLoaded.asObservable();

  constructor() {
    this.initMonaco();
  }

  private initMonaco(): void {
    if (typeof window !== 'undefined') {
      // Check if Monaco is already loaded
      if ((window as any).monaco) {
        this.monacoLoaded.next(true);
        return;
      }

      // Set up Monaco loader
      const loaderScript = document.createElement('script');
      loaderScript.src = 'assets/monaco/min/vs/loader.js';
      loaderScript.onload = () => {
        const require = (window as any).require;
        if (require) {
          require.config({ paths: { 'vs': 'assets/monaco/min/vs' } });
          require(['vs/editor/editor.main'], () => {
            this.monacoLoaded.next(true);
            console.log('Monaco editor loaded successfully via service');
          });
        }
      };
      document.body.appendChild(loaderScript);
    }
  }

  isMonacoLoaded(): boolean {
    return this.monacoLoaded.value;
  }
}
