import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, NgZone, CUSTOM_ELEMENTS_SCHEMA, ViewChild, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MonacoEditorComponent } from '../monaco-editor/monaco-editor.component';

// Configure Monaco environment
if (typeof window !== 'undefined') {
  (window as any).MonacoEnvironment = {
    getWorker: function() {
      return new Worker(
        URL.createObjectURL(
          new Blob(
            ['self.onmessage = function() { self.postMessage({}) }'],
            { type: 'text/javascript' }
          )
        )
      );
    }
  };
}

// Import monaco dynamically to avoid errors - temporarily commented out for build
let monaco: any;
// if (typeof window !== 'undefined') {
//   import('monaco-editor').then(m => {
//     monaco = m;
//   });
// }

type Language = 'javascript' | 'typescript' | 'python';

const languageMap: Record<Language, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python'
};

interface EditorOptions {
  minimap: { enabled: boolean };
  scrollBeyondLastLine: boolean;
  fontSize: number;
}

const isValidLanguage = (lang: string): lang is Language => {
  return Object.keys(languageMap).includes(lang as Language);
};

@Component({
  selector: 'app-code-playground',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="container py-4">
      <div class="row mb-4">
        <div class="col-12">
          <h1 class="practice-title">Code Playground</h1>
          <p class="practice-subtitle">Write, run and test any code in real-time</p>
        </div>
      </div>

      <div class="row">
        <div class="col-12">
          <div class="card shadow">
            <div class="card-header d-flex justify-content-between align-items-center">
              <div class="d-flex align-items-center">
                <select class="form-select me-2" [(ngModel)]="selectedLanguage" (change)="onLanguageChange()">
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                </select>
                <!-- <button class="btn btn-outline-secondary me-2" (click)="loadTemplate()">
                  <span class="me-1">📄</span> Reset to Template
                </button> -->
              </div>
              <div>
                <button class="btn btn-outline-primary me-2" (click)="formatCode()">
                  <span class="me-1">🔧</span> Format
                </button>
                <button class="btn btn-outline-danger" (click)="resetCodeAndOutput()">
                  <span class="me-1">🔄</span> Reset All
                </button>
              </div>
            </div>
            <div class="card-body p-0">
              <div class="row g-0">
                <div class="col-md-7 border-end">
                  <div class="editor-container">
                    <app-monaco-editor
                      #monacoEditor
                      [language]="selectedLanguage"
                      [value]="code"
                      [options]="editorOptions"
                      (codeChange)="handleEditorChange($event)"
                      (editorMounted)="handleEditorDidMount($event)"
                    ></app-monaco-editor>
                  </div>
                </div>
                <div class="col-md-5">
                  <div class="p-3 d-flex flex-column h-100">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                      <h5 class="mb-0">Output</h5>
                      <div>
                        <button class="btn btn-danger me-2" (click)="clearOutput()">
                          <span class="me-1">🗑️</span> Clear Output
                        </button>
                        <button class="btn btn-primary" (click)="runCode()">
                          <span class="me-1">▶️</span> Run
                        </button>
                      </div>
                    </div>
                    <div class="output-container flex-grow-1 p-3">
                      <pre class="mb-0" *ngIf="output">{{ output }}</pre>
                      <div class="text-muted" *ngIf="!output">Click 'Run' to see your code output here</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .editor-container {
      height: 500px;
      overflow: hidden;
      border: 1px solid #ccc;
      border-radius: 4px;
      position: relative;
    }

    .output-container {
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      height: 520px;
      overflow-y: auto;
    }

    .output-container pre {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 14px;
      line-height: 1.5;
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CodePlaygroundComponent implements OnInit, OnDestroy {
  @ViewChild('monacoEditor') monacoEditor!: MonacoEditorComponent;

  private editor?: any;
  private initialLoadComplete = false;
  private _isLoadingTemplate = false;
  code = '';
  output = '';
  selectedLanguage: Language = 'javascript';
  templates: Record<Language, string> = {
    javascript: 'console.log("Hello World!");\n\n// You can write any JavaScript code here\nconst numbers = [1, 2, 3, 4, 5];\nconst doubled = numbers.map(n => n * 2);\nconsole.log("Doubled numbers:", doubled);',
    typescript: 'const message: string = "Hello World!";\nconsole.log(message);\n\n// TypeScript example\ninterface Person {\n  name: string;\n  age: number;\n}\n\nconst printPerson = (person: Person): void => {\n  console.log(`${person.name} is ${person.age} years old`);\n};\n\nprintPerson({ name: "John", age: 30 });',
    python: 'print("Hello World!")\n\n# Python code will need server-side execution\ndef factorial(n):\n    if n == 0 or n == 1:\n        return 1\n    else:\n        return n * factorial(n-1)\n\nprint("Factorial of 5 is:", factorial(5))'
  };
  editorOptions: EditorOptions = {
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 14
  };

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit(): void {
    console.log('Code Playground component initialized');
    // Initialize code from template
    this.code = this.templates[this.selectedLanguage];
    // Force change detection
    setTimeout(() => {
      this.cdr.detectChanges();
      console.log('Initial change detection completed');
    }, 0);
  }

  ngOnDestroy(): void {
    console.log('Code Playground component destroyed');
    if (this.editor) {
      this.editor.dispose();
      console.log('Editor disposed');
    }
  }

  handleEditorChange(newValue: string): void {
    this.code = newValue;
    this.cdr.markForCheck();
  }

  handleEditorDidMount(editor: any): void {
    this.editor = editor;
    console.log('Editor mounted successfully');

    if (editor) {
      // Configure editor for smooth typing and to prevent cursor jumping
      editor.updateOptions({
        scrollBeyondLastLine: false,
        fixedOverflowWidgets: true,
        automaticLayout: true,
        revealHorizontalRightPadding: 30,
        scrollbar: {
          alwaysConsumeMouseWheel: false
        },
        renderWhitespace: 'none',
        renderControlCharacters: false
      });

      // Initial load of template only once after editor is ready
      setTimeout(() => {
        this.loadTemplate();
      }, 100);
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    // If editor is focused and enter key is pressed, prevent default behavior
    if (document.activeElement === this.editor?.getDomNode() && event.key === 'Enter') {
      event.stopPropagation();
    }
  }

  runCode(): void {
    if (!this.editor || !this.selectedLanguage || !isValidLanguage(this.selectedLanguage)) {
      console.error('Editor not initialized or invalid language selected');
      return;
    }

    try {
      // Save current cursor position and scroll position before running code
      const position = this.editor.getPosition();
      const scrollTop = this.editor.getScrollTop();
      const scrollLeft = this.editor.getScrollLeft();

      // Get the current code from the model directly
      const model = this.editor.getModel();
      if (!model) return;

      const code = model.getValue();
      console.log(`Running ${this.selectedLanguage} code:`, code);

      // Simple evaluation for JavaScript/TypeScript
      if (this.selectedLanguage === 'javascript' || this.selectedLanguage === 'typescript') {
        try {
          // Create a sandbox for evaluation
          const sandbox = () => {
            // Capture console output
            const originalConsole = { ...console };
            let outputLines: string[] = [];

            // Override console methods
            console.log = (...args) => {
              const output = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
              ).join(' ');
              outputLines.push(output);
              originalConsole.log(...args);
            };

            console.error = (...args) => {
              const output = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
              ).join(' ');
              outputLines.push(`Error: ${output}`);
              originalConsole.error(...args);
            };

            console.warn = (...args) => {
              const output = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
              ).join(' ');
              outputLines.push(`Warning: ${output}`);
              originalConsole.warn(...args);
            };

            console.info = (...args) => {
              const output = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
              ).join(' ');
              outputLines.push(`Info: ${output}`);
              originalConsole.info(...args);
            };

            try {
              // Execute code safely with Function constructor
              // This approach is safer than eval
              const executeCode = new Function(code);
              const result = executeCode();

              // Restore console
              console.log = originalConsole.log;
              console.error = originalConsole.error;
              console.warn = originalConsole.warn;
              console.info = originalConsole.info;

              // Return output and result
              return {
                output: outputLines.join('\n'),
                result: result !== undefined ? result : undefined
              };
            } catch (e: any) {
              // Restore console even if code execution fails
              console.log = originalConsole.log;
              console.error = originalConsole.error;
              console.warn = originalConsole.warn;
              console.info = originalConsole.info;

              throw e;
            }
          };

          // Run the sandbox
          const { output, result } = sandbox();

          // Combine output with result if available
          this.output = output;
          if (result !== undefined && !output.includes(String(result))) {
            this.output += this.output ? '\n\n' : '';
            this.output += `Return value: ${typeof result === 'object' ? JSON.stringify(result, null, 2) : result}`;
          }

          if (!this.output.trim()) {
            this.output = '// Code executed successfully with no output';
          }
        } catch (error: any) {
          this.output = `Runtime Error: ${error.message || 'Unknown error occurred'}`;
          console.error('Error executing code:', error);
        }
      } else if (this.selectedLanguage === 'python') {
        this.output = "Python execution would require a server-side interpreter.\n\nThis is a client-side playground only. In a real implementation, we would send this code to a backend service that runs Python code securely and returns the output.";
      }

      // Force change detection to update the UI
      this.cdr.detectChanges();

      // Restore cursor position and scroll position after running code
      if (position) {
        this.editor.setPosition(position);
      }
      this.editor.setScrollTop(scrollTop);
      this.editor.setScrollLeft(scrollLeft);
    } catch (error: any) {
      this.output = `System Error: ${error.message || 'Unknown error occurred'}`;
      this.cdr.markForCheck();
    }
  }

  formatCode(): void {
    if (!this.editor) return;

    try {
      // Save cursor position and scroll state
      const position = this.editor.getPosition();
      const scrollTop = this.editor.getScrollTop();
      const scrollLeft = this.editor.getScrollLeft();

      // Get the action and run it
      const action = this.editor.getAction('editor.action.formatDocument');
      if (action) {
        action.run().then(() => {
          // After formatting completes, restore position
          if (position) {
            // Get model after formatting
            const model = this.editor?.getModel();
            if (model) {
              // Make sure the position is valid
              const lineCount = model.getLineCount();
              const newLineNumber = Math.min(position.lineNumber, lineCount);
              const lineLength = model.getLineMaxColumn(newLineNumber);
              const newColumn = Math.min(position.column, lineLength);

              this.editor?.setPosition({
                lineNumber: newLineNumber,
                column: newColumn
              });
            } else {
              this.editor?.setPosition(position);
            }
          }

          // Restore scroll state
          this.editor?.setScrollTop(scrollTop);
          this.editor?.setScrollLeft(scrollLeft);

          // Make sure code state is updated
          if (this.editor) {
            this.code = this.editor.getValue();
            this.cdr.markForCheck();
          }
        });
      }
    } catch (error) {
      console.error('Error formatting code:', error);
    }
  }

  resetCode(): void {
    console.log('Reset code button clicked');
    // Create clean empty editor state
    try {
      if (this.editor) {
        // Get the model
        const model = this.editor.getModel();
        if (model) {
          // Reset to template
          this.loadTemplate();
          console.log('Editor reset to template');
        } else {
          console.error('Model not available for reset');
        }
      } else {
        console.error('Editor not available for reset');
      }
    } catch (error) {
      console.error('Error resetting code:', error);
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    // Ensure Monaco editor layout updates on window resize
    if (this.editor) {
      this.editor.layout();
      console.log('Editor layout updated on resize');
    }
  }

  loadTemplate(): void {
    console.log('Load template button clicked for language:', this.selectedLanguage);

    // Prevent multiple rapid clicks
    if (this._isLoadingTemplate) {
      console.log('Already loading template, ignoring duplicate call');
      return;
    }

    this._isLoadingTemplate = true;

    try {
      const templateCode = this.templates[this.selectedLanguage];
      console.log('Template code retrieved, length:', templateCode.length);

      if (this.editor) {
        // Store current viewport state
        const position = this.editor.getPosition();
        const scrollTop = this.editor.getScrollTop();
        const scrollLeft = this.editor.getScrollLeft();

        // Use model setValue instead of editor setValue
        const model = this.editor.getModel();
        if (model) {
          console.log('Setting template to model');
          model.setValue(templateCode);
          console.log('Model value set');
        } else {
          console.error('Model not available');
        }

        // Set position to end of document only on initial load
        if (!this.initialLoadComplete) {
          const lineCount = model?.getLineCount() || 1;
          console.log('Initial load, setting cursor to end, line:', lineCount);
          this.editor.setPosition({ lineNumber: lineCount, column: 1 });
          this.initialLoadComplete = true;
        } else if (position) {
          // Otherwise restore cursor position
          console.log('Restoring cursor position:', position);
          this.editor.setPosition(position);
        }

        // Restore scroll state
        this.editor.setScrollTop(scrollTop);
        this.editor.setScrollLeft(scrollLeft);
      } else {
        console.error('Editor not available for loading template');
      }

      // Update component state
      this.code = templateCode;
      this.output = '';

      // Force change detection with detectChanges
      this.cdr.detectChanges();
      console.log('Template loaded successfully');
    } catch (error) {
      console.error('Error loading template:', error);
    } finally {
      this._isLoadingTemplate = false;
    }
  }

  onLanguageChange(): void {
    if (!this.editor) return;

    // Store current state before language change
    const position = this.editor.getPosition();
    const scrollTop = this.editor.getScrollTop();
    const scrollLeft = this.editor.getScrollLeft();

    // Get the model first
    const model = this.editor.getModel();
    if (model) {
      // Change language on the existing model
      // Use the editor instance to change the language
      if (this.editor && monaco) {
        monaco.editor.setModelLanguage(model, this.selectedLanguage);
      }

      // Load template content only after changing language
      const templateCode = this.templates[this.selectedLanguage];

      // Update the model content using setValue on the model
      model.setValue(templateCode);

      // Update component state
      this.code = templateCode;
      this.output = '';

      // Restore cursor position and scroll state
      if (position && this.initialLoadComplete) {
        // Ensure position is valid for new content
        const lineCount = model.getLineCount();
        const newLineNumber = Math.min(position.lineNumber, lineCount);
        const lineLength = model.getLineMaxColumn(newLineNumber);
        const newColumn = Math.min(position.column, lineLength);

        this.editor.setPosition({
          lineNumber: newLineNumber,
          column: newColumn
        });
      } else {
        // If it's initial load, place cursor at end
        this.editor.setPosition({
          lineNumber: model.getLineCount(),
          column: 1
        });
        this.initialLoadComplete = true;
      }

      // Restore scroll state
      this.editor.setScrollTop(scrollTop);
      this.editor.setScrollLeft(scrollLeft);

      this.cdr.markForCheck();
    }
  }

  setLanguage(language: Language): void {
    this.selectedLanguage = language;
    this.loadTemplate();
  }

  clearOutput(): void {
    console.log('Clearing output');
    this.output = '';
    this.cdr.detectChanges();
  }

  // Method to reset both code and output
  resetCodeAndOutput(): void {
    console.log('Reset all button clicked');
    try {
      // Reset code to template
      this.loadTemplate();
      // Clear output
      this.clearOutput();
      console.log('Reset completed - both code and output');
    } catch (error) {
      console.error('Error during complete reset:', error);
    }
  }
}