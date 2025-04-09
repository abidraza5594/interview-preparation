import { Component, OnInit, OnDestroy, EventEmitter, Output, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { MockInterviewService, InterviewFeedback } from '../../../services/mock-interview.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-interview-feedback',
  templateUrl: './interview-feedback.component.html',
  styleUrls: ['./interview-feedback.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule]
})
export class InterviewFeedbackComponent implements OnInit, OnDestroy {
  @Output() retakeInterview = new EventEmitter<void>();
  @Output() endInterview = new EventEmitter<void>();
  
  private subscriptions: Subscription[] = [];
  isLoading = true;
  feedback: InterviewFeedback | null = null;
  selectedTech: string = '';
  currentState: string = 'generating_feedback';
  waitingDuration: number = 0;
  loadingProgress: number = 0;
  currentAIModel: string = 'gemini'; // Default model
  
  // Loading animation properties
  private loadingTimer: any;
  
  constructor(
    private mockInterviewService: MockInterviewService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Track interview state
    this.subscriptions.push(
      this.mockInterviewService.interviewState$.subscribe(state => {
        this.currentState = state;
        this.isLoading = state === 'generating_feedback';
        this.cdr.markForCheck();
      })
    );
    
    // Track selected tech
    this.subscriptions.push(
      this.mockInterviewService.selectedTech$.subscribe(tech => {
        this.selectedTech = tech;
        this.cdr.markForCheck();
      })
    );
    
    // Get feedback when generated
    this.subscriptions.push(
      this.mockInterviewService.feedback$.subscribe(feedback => {
        if (feedback) {
          this.feedback = feedback;
          this.cdr.markForCheck();
        }
      })
    );
    
    // Get the current AI model
    this.subscriptions.push(
      this.mockInterviewService.currentAIModel$.subscribe(model => {
        this.currentAIModel = model;
        this.cdr.markForCheck();
      })
    );
    
    // Start loading animation
    this.startLoadingAnimation();
  }

  ngOnDestroy(): void {
    // Clear the loading timer to prevent memory leaks
    if (this.loadingTimer) {
      clearInterval(this.loadingTimer);
    }
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  // Simulate loading progress incrementally over time
  private startLoadingAnimation(): void {
    if (this.currentState === 'generating_feedback') {
      // Clear any existing timer
      if (this.loadingTimer) {
        clearInterval(this.loadingTimer);
      }
      
      // Reset loading values
      this.loadingProgress = 0;
      this.waitingDuration = 0;
      
      this.loadingTimer = setInterval(() => {
        // More controlled progress increment with diminishing returns
        // Fast at first, then slows down as it approaches 95%
        const remainingProgress = 95 - this.loadingProgress;
        const increment = Math.max(0.5, remainingProgress * 0.05);
        
        this.loadingProgress = Math.min(this.loadingProgress + increment, 95);
        this.waitingDuration++;
        this.cdr.markForCheck();
        
        // Cap the maximum waiting time display at 100 seconds
        if (this.waitingDuration >= 100) {
          this.waitingDuration = 100;
        }
        
        if (this.currentState !== 'generating_feedback') {
          clearInterval(this.loadingTimer);
          this.loadingProgress = 100;
          this.cdr.markForCheck();
        }
      }, 1000);
    }
  }
  
  // Get CSS class based on rating
  getRatingClass(): string {
    if (!this.feedback) return '';
    
    const rating = this.feedback.overallRating;
    if (rating >= 8) return 'excellent';
    if (rating >= 6) return 'good';
    if (rating >= 4) return 'average';
    return 'needs-improvement';
  }
  
  // Handler for try again button
  onTryAgain(): void {
    this.retakeInterview.emit();
  }
  
  // Handler for new interview button
  onNewInterview(): void {
    this.endInterview.emit();
  }
  
  // Handler for retake interview button (legacy method - use for compatibility)
  onRetakeInterview(): void {
    this.onTryAgain();
  }
  
  // Handler for end interview button (legacy method - use for compatibility)
  onEndInterview(): void {
    this.onNewInterview();
  }
  
  // Handler for downloading feedback as PDF/text
  onDownloadFeedback(): void {
    if (!this.feedback) return;
    
    // Create a text version of the feedback
    const feedbackText = `
Mock Interview Feedback Report
-----------------------------
Tech Stack: ${this.selectedTech}
Overall Rating: ${this.feedback.overallRating}/10

STRENGTHS:
${this.feedback.strengths.map(s => `- ${s}`).join('\n')}

AREAS FOR IMPROVEMENT:
${this.feedback.weaknesses.map(w => `- ${w}`).join('\n')}

SUGGESTED TOPICS TO STUDY:
${this.feedback.suggestedTopics.map(t => `- ${t}`).join('\n')}

DETAILED FEEDBACK:
${this.feedback.detailedFeedback}
    `;
    
    // Create a download link
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(feedbackText));
    element.setAttribute('download', `mock-interview-feedback-${this.selectedTech}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }
  
  getModelDisplayName(): string {
    switch(this.currentAIModel) {
      case 'gemini': return 'Gemini AI';
      case 'mistral': return 'Mistral AI';
      case 'fallback': return 'Fallback System';
      default: return this.currentAIModel;
    }
  }
}
