import { Component, OnInit, OnDestroy, EventEmitter, Output, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { MockInterviewService } from '../../../services/mock-interview.service';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

interface TechOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-interview-setup',
  templateUrl: './interview-setup.component.html',
  styleUrls: ['./interview-setup.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule]
})
export class InterviewSetupComponent implements OnInit, OnDestroy {
  @Output() setupComplete = new EventEmitter<void>();
  
  private subscriptions: Subscription[] = [];
  interimSpeech: string = '';
  currentState: string = 'interview_setup';
  techSelected: boolean = false;
  questionCountSelected: boolean = false;
  selectedTech: string = '';
  selectedQuestionCount: number = 0;
  selectedExperienceLevel: string = 'intermediate';
  manualTechInput: string = '';
  showManualInput: boolean = false;
  
  // Available tech options for manual selection with strong typing
  techOptions: TechOption[] = [
    { id: 'javascript', name: 'JavaScript' },
    { id: 'angular', name: 'Angular' },
    { id: 'react', name: 'React' },
    { id: 'vue', name: 'Vue' },
    { id: 'nodejs', name: 'Node.js' },
    { id: 'python', name: 'Python' },
    { id: 'java', name: 'Java' },
    { id: 'csharp', name: 'C#' },
    { id: 'php', name: 'PHP' },
    { id: 'flutter', name: 'Flutter' },
    { id: 'frontend', name: 'Frontend' },
    { id: 'backend', name: 'Backend' },
    { id: 'fullstack', name: 'Fullstack' },
    { id: 'devops', name: 'DevOps' },
    { id: 'database', name: 'Database' }
  ];
  
  // Experience level options
  experienceLevels: {id: string, name: string}[] = [
    { id: 'beginner', name: 'Beginner' },
    { id: 'intermediate', name: 'Intermediate' },
    { id: 'expert', name: 'Expert' }
  ];
  
  // Question count options
  questionCountOptions: number[] = [2,5, 10, 15, 20];
  
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
    
    // Track the current interview state
    this.subscriptions.push(
      this.mockInterviewService.interviewState$.subscribe(state => {
        console.log('Interview state changed to:', state);
        this.currentState = state;
        this.cdr.markForCheck();
      })
    );
    
    // Track selected tech
    this.subscriptions.push(
      this.mockInterviewService.selectedTech$.subscribe(tech => {
        if (tech) {
          console.log('Selected tech updated to:', tech);
          this.selectedTech = tech;
          this.techSelected = true;
          this.cdr.markForCheck();
        }
      })
    );
    
    // Track question count
    this.subscriptions.push(
      this.mockInterviewService.questionCount$.subscribe(count => {
        this.selectedQuestionCount = count;
        if (this.techSelected && count > 0) {
          this.questionCountSelected = true;
        }
        this.cdr.markForCheck();
      })
    );
    
    // Track experience level
    this.subscriptions.push(
      this.mockInterviewService.experienceLevel$.subscribe(level => {
        console.log('Experience level updated to:', level);
        this.selectedExperienceLevel = level;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  selectTech(tech: string): void {
    if (!tech || tech.trim() === '') {
      return; // Don't proceed if tech is empty
    }
    
    console.log('Selecting tech:', tech);
    
    // Store the selected tech
    this.selectedTech = tech.trim();
    this.techSelected = true;
    
    // Send the selection to the service
    this.mockInterviewService.processManualInput(tech);
    
    // Provide voice feedback
    this.mockInterviewService.speak(`Now, select your experience level for ${tech}.`);
    
    // Force change detection
    this.cdr.markForCheck();
  }
  
  toggleManualInput(): void {
    this.showManualInput = !this.showManualInput;
    this.cdr.markForCheck();
  }
  
  submitManualTech(): void {
    if (this.manualTechInput && this.manualTechInput.trim() !== '') {
      this.selectTech(this.manualTechInput);
      this.manualTechInput = '';
      this.showManualInput = false;
    }
  }
  
  selectExperienceLevel(level: string): void {
    this.selectedExperienceLevel = level;
    
    // Send the selection to the service
    this.mockInterviewService.processManualInput(level);
    
    // Provide voice feedback for next step
    this.mockInterviewService.speak("How many questions would you like to attempt?");
    
    this.cdr.markForCheck();
  }
  
  selectQuestionCount(count: number): void {
    this.selectedQuestionCount = count;
    // Simulate the user saying this count
    this.mockInterviewService.processManualInput(count.toString());
    
    // Provide voice feedback for loading
    this.mockInterviewService.speak("Wait a moment, I am preparing your questions.");
  }
  
  // This will be called when both tech and question count are selected
  onSetupComplete(): void {
    this.setupComplete.emit();
  }
  
  // Method to check if a tech option is selected
  isTechSelected(tech: string): boolean {
    return this.selectedTech.toLowerCase() === tech.toLowerCase();
  }
  
  // Method to check if an experience level is selected
  isExperienceSelected(level: string): boolean {
    return this.selectedExperienceLevel === level;
  }
  
  // Trackby function for better performance
  trackByTech(index: number, tech: TechOption): string {
    return tech.id;
  }
  
  trackByLevel(index: number, level: {id: string, name: string}): string {
    return level.id;
  }
  
  trackByCount(index: number, count: number): number {
    return count;
  }
}
