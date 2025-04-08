import { Component, OnInit, OnDestroy, EventEmitter, Output, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { MockInterviewService } from '../../../services/mock-interview.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-interview-greeting',
  templateUrl: './interview-greeting.component.html',
  styleUrls: ['./interview-greeting.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule]
})
export class InterviewGreetingComponent implements OnInit, OnDestroy {
  @Input() userName: string = '';
  @Output() greeting = new EventEmitter<{ accepted: boolean }>();
  
  private subscriptions: Subscription[] = [];
  interimSpeech: string = '';
  showTypingIndicator: boolean = false;
  greetingMessage: string = '';
  
  constructor(
    private mockInterviewService: MockInterviewService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Listen for interim speech recognition results
    this.subscriptions.push(
      this.mockInterviewService.interimUserResponse$.subscribe(interim => {
        this.interimSpeech = interim;
        this.cdr.markForCheck();
      })
    );
    
    // Get the initial greeting from the service
    this.subscriptions.push(
      this.mockInterviewService.interviewState$.subscribe(state => {
        if (state === 'greeting') {
          this.showTypingIndicator = true;
          this.cdr.markForCheck();
          
          setTimeout(() => {
            this.showTypingIndicator = false;
            // Create personalized greeting in English
            const personalGreeting = this.userName && this.userName !== 'Guest' 
              ? `Hello ${this.userName}! I'm your AI interviewer.` 
              : `Hello! I'm your AI interviewer.`;
            
            this.greetingMessage = `${personalGreeting} Are you ready for your technical interview?`;
            this.cdr.markForCheck();
          }, 1000);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onPositiveResponse(): void {
    this.mockInterviewService.processManualInput('Yes, I am ready');
    this.greeting.emit({ accepted: true });
  }

  onNegativeResponse(): void {
    console.log('User declined to start interview');
    
    // Speak a goodbye message before ending the interview
    const goodbyeMessage = "No problem! Feel free to come back when you're ready to practice. Have a great day!";
    this.mockInterviewService.speak(goodbyeMessage);
    
    // Let the message be spoken before ending the interview
    setTimeout(() => {
      this.mockInterviewService.endInterview();
      this.greeting.emit({ accepted: false });
    }, 3000); // Give it 3 seconds to finish speaking
  }
}
