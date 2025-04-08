import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { MockInterviewService, InterviewFeedback, InterviewQuestion } from '../../services/mock-interview.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { ThemeService } from '../../services/theme.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Import standalone components
import { InterviewGreetingComponent } from './interview-greeting/interview-greeting.component';
import { InterviewSetupComponent } from './interview-setup/interview-setup.component';
import { InterviewQuestionsComponent } from './interview-questions/interview-questions.component';
import { InterviewFeedbackComponent } from './interview-feedback/interview-feedback.component';
import { SpeechControlComponent } from './speech-control/speech-control.component';

interface VoiceOption {
  name: string;
  voiceURI: string;
}

@Component({
  selector: 'app-mock-interview',
  templateUrl: './mock-interview.component.html',
  styleUrls: ['./mock-interview.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    InterviewGreetingComponent,
    InterviewSetupComponent,
    InterviewQuestionsComponent,
    InterviewFeedbackComponent,
    SpeechControlComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  standalone: true
})
export class MockInterviewComponent implements OnInit, OnDestroy {
  interviewInProgress = false;
  interviewState = 'initial';
  currentUserResponse = '';
  interimUserResponse = ''; // To show real-time speech recognition
  selectedTech: string = '';
  questionCount = 5;
  currentQuestionIndex = 0;
  questions: InterviewQuestion[] = [];
  feedback: InterviewFeedback | null = null;
  userName = '';
  isLoggedIn = false; // Add this flag for checking login status
  isDarkMode = false;
  
  // Voice selection options
  availableVoices: SpeechSynthesisVoice[] = [];
  selectedVoice = 'default';
  autoPreviewEnabled = true;
  selectedCharacter = 'robot'; // Default character
  
  // Manual text input as backup
  manualInputEnabled = false;
  manualUserResponse = '';
  
  waitingDuration = 0;
  waitingTimer: any;
  speechRecognitionWorking = true;
  lastSpeechUpdateTime = new Date().getTime();
  speechStatusInterval: any;
  
  experienceLevel = 'intermediate'; // Default value
  
  private subscriptions: Subscription[] = [];
  
  constructor(
    private mockInterviewService: MockInterviewService,
    private authService: AuthService,
    private afAuth: AngularFireAuth,
    private themeService: ThemeService,
    private cdr: ChangeDetectorRef
  ) { }
  
  ngOnInit(): void {
    // Get current user info
    this.subscriptions.push(
      this.afAuth.authState.subscribe(user => {
        if (user) {
          this.userName = user.displayName || 'User';
          this.isLoggedIn = true; // Set login flag to true
        } else {
          this.userName = 'Guest';
          this.isLoggedIn = false; // Set login flag to false
        }
        this.cdr.markForCheck();
      })
    );
    
    // Subscribe to theme changes
    this.subscriptions.push(
      this.themeService.darkMode$.subscribe(isDark => {
        this.isDarkMode = isDark;
        this.cdr.markForCheck();
      })
    );
    
    // Subscribe to interview state changes
    this.subscriptions.push(
      this.mockInterviewService.interviewInProgress$.subscribe(inProgress => {
        this.interviewInProgress = inProgress;
        this.cdr.markForCheck();
      })
    );
    
    this.subscriptions.push(
      this.mockInterviewService.interviewState$.subscribe(state => {
        this.interviewState = state;
        this.cdr.markForCheck();
        
        // Reset waiting duration when entering loading state
        if (state === 'loading_questions' || state === 'generating_feedback') {
          this.waitingDuration = 0;
          this.startWaitingTimer();
        } else {
          this.stopWaitingTimer();
        }
      })
    );
    
    this.subscriptions.push(
      this.mockInterviewService.currentUserResponse$.subscribe(response => {
        this.currentUserResponse = response;
        this.cdr.markForCheck();
      })
    );
    
    this.subscriptions.push(
      this.mockInterviewService.interimUserResponse$.subscribe(interim => {
        this.interimUserResponse = interim;
        // Update speech status whenever we get interim results
        if (interim) {
          this.onSpeechUpdate();
        }
        this.cdr.markForCheck();
      })
    );
    
    this.subscriptions.push(
      this.mockInterviewService.selectedTech$.subscribe(tech => {
        this.selectedTech = tech;
        this.cdr.markForCheck();
      })
    );
    
    this.subscriptions.push(
      this.mockInterviewService.questionCount$.subscribe(count => {
        this.questionCount = count;
        this.cdr.markForCheck();
      })
    );
    
    this.subscriptions.push(
      this.mockInterviewService.currentQuestionIndex$.subscribe(index => {
        this.currentQuestionIndex = index;
        this.cdr.markForCheck();
      })
    );
    
    this.subscriptions.push(
      this.mockInterviewService.questions$.subscribe(questions => {
        this.questions = questions;
        this.cdr.markForCheck();
      })
    );
    
    this.subscriptions.push(
      this.mockInterviewService.feedback$.subscribe(feedback => {
        this.feedback = feedback;
        this.cdr.markForCheck();
      })
    );
    
    // Subscribe to available voices
    this.subscriptions.push(
      this.mockInterviewService.availableVoices$.subscribe(voices => {
        if (voices.length > 0) {
          this.availableVoices = voices;
          this.cdr.markForCheck();
        }
      })
    );
    
    this.subscriptions.push(
      this.mockInterviewService.interviewerVoice$.subscribe(voice => {
        this.selectedVoice = voice;
        this.cdr.markForCheck();
      })
    );
    
    this.subscriptions.push(
      this.mockInterviewService.interviewerCharacter$.subscribe(character => {
        this.selectedCharacter = character;
        this.cdr.markForCheck();
      })
    );
    
    // If speech recognition is supported, check its status periodically
    this.checkSpeechRecognitionStatus();
    
    // Subscribe to experience level
    this.mockInterviewService.experienceLevel$.subscribe(level => {
      this.experienceLevel = level;
    });
  }
  
  ngOnDestroy(): void {
    // Clear all subscriptions to prevent memory leaks
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Clear any intervals
    if (this.waitingTimer) {
      clearInterval(this.waitingTimer);
    }
    
    if (this.speechStatusInterval) {
      clearInterval(this.speechStatusInterval);
    }
    
    // Stop speech recognition if active
    this.mockInterviewService.stopListening();
  }
  
  startInterview(): void {
    if (!this.userName) {
      this.userName = 'Candidate';
    }
    
    // Check if already in progress and reset if needed
    if (this.interviewInProgress) {
      this.endInterview();
      setTimeout(() => this.startInterview(), 500);
      return;
    }
    
    // Set the voice before starting the interview
    if (this.selectedVoice) {
      this.mockInterviewService.setInterviewerVoice(this.selectedVoice);
    }
    
    // Set the character
    this.mockInterviewService.setCharacter(this.selectedCharacter);
    
    // Small delay to ensure voice is set before starting
    setTimeout(() => {
      this.interviewInProgress = true;
      
      // Start with proceed confirmation state
      this.interviewState = 'proceed_confirmation';
      
      // Start the interview process and pass the userName
      this.mockInterviewService.startInterview(this.userName, 'proceed_confirmation');
      
      // Force change detection
      this.cdr.markForCheck();
    }, 300);
  }
  
  endInterview(): void {
    console.log('Ending interview');
    
    // Voice feedback if coming from proceed_confirmation state
    if (this.interviewState === 'proceed_confirmation') {
      this.mockInterviewService.speak("No problem! When you're ready to practice, feel free to start again.");
    }
    
    this.interviewInProgress = false;
    this.interviewState = 'initial';
    this.mockInterviewService.endInterview();
    
    // Reset local state
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.speechRecognitionWorking = true;
    this.interimUserResponse = '';
    this.manualUserResponse = '';
    
    this.cdr.markForCheck();
  }
  
  retakeInterview(): void {
    this.mockInterviewService.retakeInterview();
  }
  
  getProgressPercentage(): number {
    if (!this.questions.length) return 0;
    return (this.currentQuestionIndex / this.questions.length) * 100;
  }
  
  getCurrentQuestion(): string {
    if (this.questions.length && this.currentQuestionIndex < this.questions.length) {
      return this.questions[this.currentQuestionIndex].question;
    }
    return '';
  }
  
  getRatingClass(): string {
    if (!this.feedback) return '';
    
    const rating = this.feedback.overallRating;
    if (rating >= 8) return 'excellent';
    if (rating >= 6) return 'good';
    if (rating >= 4) return 'average';
    return 'poor';
  }
  
  onVoiceSelected(voiceURI: string): void {
    this.selectedVoice = voiceURI;
    this.mockInterviewService.setInterviewerVoice(voiceURI);
    
    // Only preview if auto-preview is enabled
    if (this.autoPreviewEnabled) {
      this.previewSelectedVoice();
    }
  }
  
  previewSelectedVoice(): void {
    if (this.selectedVoice) {
      console.log('Previewing selected voice:', this.selectedVoice);
      this.mockInterviewService.setInterviewerVoice(this.selectedVoice);
    }
  }
  
  toggleAutoPreview(): void {
    this.autoPreviewEnabled = !this.autoPreviewEnabled;
  }
  
  toggleManualInput(): void {
    this.manualInputEnabled = !this.manualInputEnabled;
  }
  
  adjustNoiseSensitivity(level: 'low' | 'medium' | 'high'): void {
    this.mockInterviewService.adjustNoiseSensitivity(level);
    console.log(`Noise sensitivity adjusted to: ${level}`);
  }
  
  sendManualResponse(): void {
    if (this.manualUserResponse.trim()) {
      this.mockInterviewService.processManualInput(this.manualUserResponse);
      this.manualUserResponse = '';
    }
  }
  
  restartSpeechRecognition(): void {
    this.mockInterviewService.restartListening();
    this.speechRecognitionWorking = true;
    this.lastSpeechUpdateTime = new Date().getTime();
    this.cdr.markForCheck();
  }
  
  selectCharacter(character: string): void {
    this.selectedCharacter = character;
    this.mockInterviewService.setCharacter(character);
  }
  
  selectExperienceLevel(level: string): void {
    this.experienceLevel = level;
    this.mockInterviewService.processManualInput(level);
  }
  
  // Deal with voice changes
  onVoiceChangeEvent(): void {
    this.mockInterviewService.setInterviewerVoice(this.selectedVoice);
    
    // Only preview if auto-preview is enabled
    if (this.autoPreviewEnabled) {
      this.previewSelectedVoice();
    }
  }
  
  // Add speech recognition status check
  private checkSpeechRecognitionStatus(): void {
    // Check every 5 seconds if speech recognition is working
    this.speechStatusInterval = setInterval(() => {
      // If we haven't received any interim text update for more than 10 seconds
      // while in an active interview state, we might have a problem
      const activeStates = ['greeting', 'interview_setup', 'question_count', 'answering'];
      
      if (this.interviewInProgress && activeStates.includes(this.interviewState)) {
        const now = new Date().getTime();
        
        // If it's been more than 10 seconds since the last interim update, show warning
        if (now - this.lastSpeechUpdateTime > 10000) {
          this.speechRecognitionWorking = false;
        }
      }
    }, 5000);
  }
  
  // Track speech updates
  onSpeechUpdate(): void {
    this.lastSpeechUpdateTime = new Date().getTime();
    this.speechRecognitionWorking = true;
    this.cdr.markForCheck();
  }
  
  // Handle manual input submission
  submitManualInput(response: string): void {
    if (!response || !response.trim()) {
      return;
    }
    
    console.log('Submitting manual input:', response);
    this.mockInterviewService.processManualInput(response);
    this.manualUserResponse = ''; // Clear the input
    this.cdr.markForCheck();
  }
  
  // Process manual input based on the current interview state
  private processManualInputBasedOnState(): void {
    const input = this.manualUserResponse.trim();
    
    // For the most common case - just pass to the service
    this.mockInterviewService.processManualInput(input);
    
    // Additional state-specific processing if needed
    if (this.interviewState === 'greeting' && !this.speechRecognitionWorking) {
      // If in greeting state, check for simple "yes" responses
      const yesResponses = ['yes', 'yeah', 'sure', 'ok', 'okay', 'ready', 'start', 'begin'];
      const isPositive = yesResponses.some(response => 
        input.toLowerCase().includes(response.toLowerCase()));
      
      if (isPositive) {
        setTimeout(() => {
          // Move to next state if not already done by the service
          if (this.interviewState === 'greeting') {
            this.mockInterviewService.processManualInput('yes I am ready to begin');
          }
        }, 500);
      }
    }
  }
  
  // Start waiting timer for loading states
  private startWaitingTimer(): void {
    // Reset waiting duration first
    this.waitingDuration = 0;
    
    // Clear any existing timer
    if (this.waitingTimer) {
      clearInterval(this.waitingTimer);
    }
    
    this.waitingTimer = setInterval(() => {
      // Cap the waiting duration at 100 seconds for UI display
      if (this.waitingDuration < 100) {
        this.waitingDuration += 1;
        this.cdr.markForCheck();
      } else {
        // If we've reached 100 seconds, stop the timer but keep the UI at 100%
        this.stopWaitingTimer();
        
        // If we're still in generating_feedback state after 100 seconds,
        // force completion with emergency feedback
        if (this.interviewState === 'generating_feedback') {
          console.log('Forcing feedback completion after 100 seconds');
          this.mockInterviewService.speak("Almost done with your feedback analysis.");
          
          // Give the service more time to finish on its own
          setTimeout(() => {
            // Only force if still in generating state
            if (this.interviewState === 'generating_feedback') {
              // Force feedback generation to complete
              this.mockInterviewService.updateInterviewState('feedback');
              this.cdr.markForCheck();
            }
          }, 5000);
        }
      }
    }, 1000);
  }
  
  // Stop waiting timer
  private stopWaitingTimer(): void {
    if (this.waitingTimer) {
      clearInterval(this.waitingTimer);
    }
  }
  
  // Event handlers for child components
  onGreetingResponse(event: { accepted: boolean }): void {
    console.log('Greeting response:', event);
    if (!event.accepted) {
      console.log('User is not ready, ending interview');
      this.interviewInProgress = false;
      this.interviewState = 'initial';
      this.mockInterviewService.endInterview();
      this.cdr.markForCheck();
    }
    // If accepted, the service will automatically proceed to the next state
  }
  
  onSetupComplete(): void {
    // This is called when the setup process is complete
    console.log('Setup complete, moving to questions phase');
    this.cdr.markForCheck();
  }
  
  onQuestionsComplete(): void {
    console.log('All questions have been answered, preparing feedback');
  }
  
  // Method to proceed from confirmation to tech stack
  proceedToTechStack(): void {
    console.log('Proceeding to tech stack selection');
    this.interviewState = 'interview_setup';
    this.mockInterviewService.updateInterviewState('interview_setup');
    
    // Provide voice feedback
    this.mockInterviewService.speak("Great! Please select your tech stack.");
    
    this.cdr.markForCheck();
  }
} 