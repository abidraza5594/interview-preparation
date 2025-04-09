import { Component, OnInit, Input, Output, EventEmitter, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder } from '@angular/forms';
import { PracticeQuestion } from '../../services/practice.service';

@Component({
  selector: 'app-online-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="modal" [class.show]="isVisible" [style.display]="isVisible ? 'block' : 'none'" tabindex="-1">
      <div class="modal-dialog modal-xl modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ question?.title || 'Online Editor' }}</h5>
            <button type="button" class="btn-close" (click)="close.emit()"></button>
          </div>
          <div class="modal-body">
            <div class="row">
              <div class="col-md-6">
                <form [formGroup]="editorForm">
                  <textarea 
                    formControlName="code"
                    class="form-control code-editor font-monospace" 
                    style="height: 500px; resize: none;"
                    spellcheck="false"
                  ></textarea>
                </form>
                <div class="mt-3">
                  <button class="btn btn-primary me-2" (click)="runCode()">
                    <i class="fas fa-play me-1"></i> Run
                  </button>
                  <button class="btn btn-outline-danger" (click)="resetCode()">
                    <i class="fas fa-undo me-1"></i> Reset
                  </button>
                </div>
              </div>
              <div class="col-md-6">
                <div class="output-container bg-light p-3 rounded" style="height: 500px; overflow-y: auto;">
                  <h6 class="mb-3">Output:</h6>
                  <pre class="mb-0" *ngIf="output">{{ output }}</pre>
                  <div class="text-muted" *ngIf="!output">Run your code to see the output here</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      background-color: rgba(0, 0, 0, 0.5);
    }
    .modal.show {
      background-color: rgba(0, 0, 0, 0.5);
    }
    :host {
      display: block;
    }
    .code-editor {
      font-family: 'Consolas', 'Monaco', monospace;
      tab-size: 2;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OnlineEditorComponent implements OnInit {
  @Input() isVisible = false;
  @Input() question?: PracticeQuestion;
  @Output() close = new EventEmitter<void>();

  editorForm: FormGroup;
  output = '';

  constructor(private fb: FormBuilder) {
    this.editorForm = this.fb.group({
      code: ['// Write your code here\n']
    });
  }

  ngOnInit() {
    if (this.question?.codeTemplate) {
      this.editorForm.patchValue({
        code: this.question.codeTemplate
      });
    }
  }

  runCode() {
    const code = this.editorForm.get('code')?.value;
    if (!code) return;

    try {
      // Using Function constructor to create a sandbox
      const result = new Function(code)();
      this.output = String(result);
    } catch (error) {
      this.output = `Error: ${error}`;
    }
  }

  resetCode() {
    this.editorForm.patchValue({
      code: this.question?.codeTemplate || '// Write your code here\n'
    });
    this.output = '';
  }
} 