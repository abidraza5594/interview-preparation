import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MockInterviewComponent } from '../mock-interview.component';
import { InterviewGreetingComponent } from '../interview-greeting/interview-greeting.component';
import { InterviewSetupComponent } from '../interview-setup/interview-setup.component';
import { InterviewQuestionsComponent } from '../interview-questions/interview-questions.component';
import { InterviewFeedbackComponent } from '../interview-feedback/interview-feedback.component';
import { SpeechControlComponent } from '../speech-control/speech-control.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    MockInterviewComponent,
    InterviewGreetingComponent,
    InterviewSetupComponent,
    InterviewQuestionsComponent,
    InterviewFeedbackComponent,
    SpeechControlComponent
  ],
  exports: [
    MockInterviewComponent
  ]
})
export class MockInterviewModule { }
