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
  isSubmitting: boolean = false;
  errorMessage: string = '';
  currentAIModel: string = 'gemini'; // Default model
  
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
        
        // Load any existing response for this question
        this.loadExistingResponse(index);
        
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
    
    // Listen for AI model changes
    this.subscriptions.push(
      this.mockInterviewService.currentAIModel$.subscribe((model: string) => {
        this.currentAIModel = model;
        this.cdr.markForCheck();
      })
    );
    
    // Listen for errors from the service
    this.subscriptions.push(
      this.mockInterviewService.errorMessage$.subscribe((message: string) => {
        if (message) {
          this.errorMessage = message;
          // Auto-clear error after 5 seconds
          setTimeout(() => {
            this.errorMessage = '';
            this.cdr.markForCheck();
          }, 5000);
        } else {
          this.errorMessage = '';
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
  
  prevQuestion(): void {
    if (this.currentQuestionIndex > 0) {
      // Save current response if any
      if (this.manualResponse && this.manualResponse.trim()) {
        this.mockInterviewService.storeResponseForCurrentQuestion(this.manualResponse);
      }
      
      // Go to previous question
      this.mockInterviewService.navigateToQuestion(this.currentQuestionIndex - 1);
      
      // Reset the manual response field and load any saved response
      this.manualResponse = this.mockInterviewService.getResponseForQuestion(this.currentQuestionIndex - 1) || '';
      
      // Trigger change detection
      this.cdr.markForCheck();
    }
  }
  
  nextQuestion(): void {
    // First check if current question has an answer
    if (this.manualResponse && this.manualResponse.trim()) {
      this.mockInterviewService.storeResponseForCurrentQuestion(this.manualResponse);
    }

    // Only proceed if we're not at the last question
    if (this.currentQuestionIndex < this.questions.length - 1) {
      // Go to next question in sequence
      this.mockInterviewService.navigateToQuestion(this.currentQuestionIndex + 1);
      this.manualResponse = this.mockInterviewService.getResponseForQuestion(this.currentQuestionIndex + 1) || '';
    }
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
    if (!response || !response.trim()) {
      this.errorMessage = 'Please provide an answer before submitting.';
      this.cdr.markForCheck();
      return;
    }

    // Clear any previous error message
    this.errorMessage = '';

    console.log('Submitting manual response:', response);
    
    // Check if the answer is too short or potentially random text
    if (response.trim().length < 15) {
      // Show a warning prompt before submitting very short answers
      if (!confirm('Your answer seems very short. Are you sure you want to submit it? Click Cancel to continue editing.')) {
        return; // User chose to continue editing
      }
    }
    
    // Show loading indicator
    this.isSubmitting = true;
    
    // Inform user that we're analyzing their answer
    this.mockInterviewService.speak('I am analyzing your answer. This might take a moment as I evaluate your response thoroughly.');
    
    // Process the response and handle submission
    this.mockInterviewService.processManualInput(response);
    
    // Clear the input field after submitting
    this.manualResponse = '';
    
    // Hide loading after a delay - increased to account for API processing time
    setTimeout(() => {
      this.isSubmitting = false;
      this.cdr.markForCheck();
    }, 8000);  // Increased from 1000ms to 8000ms to give more time for API calls
    
    this.cdr.markForCheck();
  }
  
  async changeQuestion(): Promise<void> {
    // Show loading indicator (could add a spinner in the component)
    const newQuestionButton = document.querySelector('.new-question-button');
    const oldBtnText = newQuestionButton?.textContent || '<i class="fas fa-exchange-alt"></i> New Question';
    
    if (newQuestionButton) {
      newQuestionButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    }
    
    try {
      // Reset the manual response field
      this.manualResponse = '';
      
      // Call the service to replace the current question with a new one
      const success = await this.mockInterviewService.replaceCurrentQuestion();
      
      if (!success) {
        console.error('Failed to replace question');
        // If we fail to get a new question, we can restore the button text
        if (newQuestionButton) {
          newQuestionButton.innerHTML = oldBtnText;
        }
      }
      
      // Trigger change detection
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error replacing question:', error);
      
      // Restore button text on error
      if (newQuestionButton) {
        newQuestionButton.innerHTML = oldBtnText;
      }
    } finally {
      // Restore button text after 2 seconds regardless of outcome
      setTimeout(() => {
        const button = document.querySelector('.new-question-button');
        if (button) {
          button.innerHTML = '<i class="fas fa-exchange-alt"></i> New Question';
        }
      }, 2000);
    }
  }
  
  submitInterview(): void {
    // First, check if there are any unanswered questions
    const totalQuestions = this.questions.length;
    const unansweredQuestions = [];
    
    // Save current response if any
    if (this.manualResponse && this.manualResponse.trim()) {
      this.mockInterviewService.storeResponseForCurrentQuestion(this.manualResponse);
    }
    
    // Check each question for an answer
    for (let i = 0; i < totalQuestions; i++) {
      const response = this.mockInterviewService.getResponseForQuestion(i);
      if (!response || response.trim() === '') {
        unansweredQuestions.push(i + 1);
      }
    }
    
    // If there are unanswered questions, navigate to the first one
    if (unansweredQuestions.length > 0) {
      const firstUnansweredIndex = unansweredQuestions[0] - 1;
      this.mockInterviewService.navigateToQuestion(firstUnansweredIndex);
      this.manualResponse = this.mockInterviewService.getResponseForQuestion(firstUnansweredIndex) || '';
      const message = `Please answer all questions before submitting. Starting with question ${unansweredQuestions[0]}.`;
      this.mockInterviewService.speak(message);
      return;
    }

    // If all questions are answered, proceed with submission
    if (confirm('Are you sure you want to end the interview and get feedback?')) {
      console.log('User confirmed interview submission');
      
      // Show loading state
      this.isSubmitting = true;
      
      // Speak a message about generating comprehensive feedback
      this.mockInterviewService.speak('I am now generating comprehensive feedback on all your answers. This may take a moment as I analyze your performance across all questions.');
      
      this.mockInterviewService.manualSubmitInterview();
      
      // Reset the submission state after a delay
      setTimeout(() => {
        this.isSubmitting = false;
        this.cdr.markForCheck();
      }, 10000);
    }
  }

  private loadExistingResponse(questionIndex: number): void {
    // Get any saved response for this question
    const savedResponse = this.mockInterviewService.getResponseForQuestion(questionIndex);
    
    // If there's a saved response that isn't a system marker like [SKIPPED]
    if (savedResponse && savedResponse !== '[SKIPPED]') {
      console.log(`Loading saved response for question ${questionIndex}`);
      this.manualResponse = savedResponse;
    } else {
      // Clear the response field for questions without saved responses
      this.manualResponse = '';
    }
  }
}
