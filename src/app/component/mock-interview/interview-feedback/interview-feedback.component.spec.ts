import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewFeedbackComponent } from './interview-feedback.component';

describe('InterviewFeedbackComponent', () => {
  let component: InterviewFeedbackComponent;
  let fixture: ComponentFixture<InterviewFeedbackComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterviewFeedbackComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InterviewFeedbackComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
