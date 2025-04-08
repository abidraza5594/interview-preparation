import { Component, OnInit, OnDestroy, EventEmitter, Output, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { MockInterviewService, InterviewQuestion } from '../../../services/mock-interview.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-interview-questions',
  templateUrl: './interview-questions.component.html',
  styleUrls: ['./interview-questions.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class InterviewQuestionsComponent implements OnInit, OnDestroy {
  @Output() questionsComplete = new EventEmitter<void>();
  
  private subscriptions: Subscription[] = [];
  questions: InterviewQuestion[] = [];
  currentQuestionIndex: number = 0;
  interimSpeech: string = '';
  currentUserResponse: string = '';
  isAISpeaking: boolean = false;
  manualResponse: string = '';
  
  constructor(
    private mockInterviewService: MockInterviewService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Get the questions
    this.subscriptions.push(
      this.mockInterviewService.questions$.subscribe(questions => {
        this.questions = questions;
        console.log('Questions loaded:', questions.length);
        
        // If we have questions but the state isn't 'answering', fix it
        if (questions.length > 0) {
          this.mockInterviewService.updateInterviewState('answering');
        }
        
        this.cdr.markForCheck();
      })
    );
    
    // Track the current question index
    this.subscriptions.push(
      this.mockInterviewService.currentQuestionIndex$.subscribe(index => {
        this.currentQuestionIndex = index;
        console.log('Current question index updated:', index);
        this.cdr.markForCheck();
      })
    );
    
    // Listen for interim speech recognition results
    this.subscriptions.push(
      this.mockInterviewService.interimUserResponse$.subscribe(interim => {
        this.interimSpeech = interim;
        this.cdr.markForCheck();
      })
    );
    
    // Listen for the final user response
    this.subscriptions.push(
      this.mockInterviewService.currentUserResponse$.subscribe(response => {
        this.currentUserResponse = response;
        this.cdr.markForCheck();
      })
    );
    
    // Listen for AI speaking state
    this.subscriptions.push(
      this.mockInterviewService.isAISpeaking$.subscribe(speaking => {
        this.isAISpeaking = speaking;
        this.cdr.markForCheck();
      })
    );
    
    // Listen for state changes to detect when questions are completed
    this.subscriptions.push(
      this.mockInterviewService.interviewState$.subscribe(state => {
        if (state === 'generating_feedback') {
          this.questionsComplete.emit();
        }
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  getCurrentQuestion(): string {
    if (this.questions.length > 0 && this.currentQuestionIndex < this.questions.length) {
      return this.questions[this.currentQuestionIndex].question;
    }
    return '';
  }
  
  getProgressPercentage(): number {
    if (this.questions.length === 0) return 0;
    return ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
  }
  
  skipQuestion(): void {
    console.log('Skip question requested for index:', this.currentQuestionIndex);
    // Call the service method to skip the current question
    this.mockInterviewService.skipCurrentQuestion();
  }
  
  restartSpeechRecognition(): void {
    this.mockInterviewService.restartListening();
  }
  
  stopAISpeaking(): void {
    if (this.isAISpeaking) {
      this.mockInterviewService.stopSpeaking();
    }
  }
  
  submitManualResponse(response: string): void {
    if (response && response.trim()) {
      console.log('Submitting manual response:', response);
      this.mockInterviewService.processManualInput(response);
      // Clear the input field after submitting
      this.manualResponse = '';
      this.cdr.markForCheck();
    }
  }
}
