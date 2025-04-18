import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Editor as MonacoEditor } from '@monaco-editor/react';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-monaco-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="monaco-editor-container" style="width: 100%; height: 100%; min-height: 300px;">
      <div #editorContainer style="width: 100%; height: 100%;"></div>
    </div>
  `
})
export class MonacoEditorComponent implements OnInit, OnDestroy {
  @ViewChild('editorContainer', { static: true }) editorContainer!: ElementRef;

  @Input() language: string = 'javascript';
  @Input() value: string = '// Type your code here';
  @Input() options: any = {
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 14,
    automaticLayout: true
  };

  @Output() codeChange = new EventEmitter<string>();
  @Output() editorMounted = new EventEmitter<any>();

  private editor: any = null;
  private _monaco: any = null;
  private _subscription: any = null;

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    this.initMonaco();
  }

  ngOnDestroy(): void {
    if (this.editor) {
      this.editor.dispose();
    }
    if (this._subscription) {
      this._subscription.unsubscribe();
    }
  }

  private initMonaco(): void {
    if (typeof window === 'undefined') return;

    // Load Monaco dynamically
    import('monaco-editor').then(monaco => {
      this._monaco = monaco;
      this.ngZone.runOutsideAngular(() => {
        if (!this.editorContainer || !this.editorContainer.nativeElement) {
          console.error('Editor container not found');
          return;
        }

        try {
          // Create editor
          this.editor = monaco.editor.create(this.editorContainer.nativeElement, {
            value: this.value,
            language: this.language,
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            ...this.options
          });

          // Set up change event
          this.editor.onDidChangeModelContent(() => {
            const value = this.editor.getValue();
            this.ngZone.run(() => {
              this.codeChange.emit(value);
            });
          });

          // Notify that editor is mounted
          this.ngZone.run(() => {
            console.log('Monaco editor mounted successfully');
            this.editorMounted.emit(this.editor);
          });
        } catch (error) {
          console.error('Error initializing Monaco editor:', error);
        }
      });
    }).catch(error => {
      console.error('Failed to load Monaco editor:', error);
    });
  }

  // Method to get the editor instance
  getEditorInstance(): any {
    return this.editor;
  }

  // Method to set the value programmatically
  setValue(value: string): void {
    if (this.editor) {
      this.editor.setValue(value);
    }
  }

  // Method to get the current value
  getValue(): string {
    if (this.editor) {
      return this.editor.getValue();
    }
    return '';
  }
}
