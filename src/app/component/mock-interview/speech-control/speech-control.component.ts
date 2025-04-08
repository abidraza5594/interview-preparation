import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, EventEmitter, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { MockInterviewService } from '../../../services/mock-interview.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-speech-control',
  templateUrl: './speech-control.component.html',
  styleUrls: ['./speech-control.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class SpeechControlComponent implements OnInit, OnDestroy {
  private subscriptions: Subscription[] = [];
  isListening: boolean = false;
  interimSpeech: string = '';
  manualInputEnabled: boolean = false;
  manualInput: string = '';
  
  // Noise sensitivity settings
  noiseSensitivity: 'low' | 'medium' | 'high' = 'medium';
  
  // Add an EventEmitter to notify the parent component when manual input is submitted
  @Output() manualSubmit = new EventEmitter<string>();
  
  constructor(
    private mockInterviewService: MockInterviewService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Track interim speech to determine if speech recognition is working
    this.subscriptions.push(
      this.mockInterviewService.interimUserResponse$.subscribe(interim => {
        this.interimSpeech = interim;
        if (interim) {
          this.isListening = true;
          this.setLastSpeechUpdate();
        }
        this.cdr.markForCheck();
      })
    );
    
    // Check speech recognition status periodically
    setInterval(() => {
      this.checkSpeechStatus();
    }, 5000);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  restartSpeechRecognition(): void {
    this.mockInterviewService.restartListening();
    this.isListening = true;
    this.setLastSpeechUpdate();
    this.cdr.markForCheck();
  }
  
  toggleManualInput(): void {
    this.manualInputEnabled = !this.manualInputEnabled;
    this.cdr.markForCheck();
  }
  
  // Update the submit method to emit the input value
  submitManualInput(): void {
    if (!this.manualInput || !this.manualInput.trim()) {
      return;
    }
    
    // Process the input through the service directly
    this.mockInterviewService.processManualInput(this.manualInput);
    
    // Clear the input field
    const tempInput = this.manualInput;
    this.manualInput = '';
    
    // Also notify the parent component if needed
    this.manualSubmit.emit(tempInput);
  }
  
  // Set noise sensitivity level
  setNoiseSensitivity(level: 'low' | 'medium' | 'high'): void {
    this.noiseSensitivity = level;
    this.mockInterviewService.adjustNoiseSensitivity(level);
    this.cdr.markForCheck();
  }
  
  private lastSpeechUpdateTime = new Date().getTime();
  
  private setLastSpeechUpdate(): void {
    this.lastSpeechUpdateTime = new Date().getTime();
  }
  
  private checkSpeechStatus(): void {
    const currentTime = new Date().getTime();
    const timeSinceLastUpdate = currentTime - this.lastSpeechUpdateTime;
    
    // If it's been more than 20 seconds since last speech update, assume recognition isn't working
    if (timeSinceLastUpdate > 20000) {
      this.isListening = false;
      this.cdr.markForCheck();
    }
  }
}
