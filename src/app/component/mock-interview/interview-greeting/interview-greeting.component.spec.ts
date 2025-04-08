import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewGreetingComponent } from './interview-greeting.component';

describe('InterviewGreetingComponent', () => {
  let component: InterviewGreetingComponent;
  let fixture: ComponentFixture<InterviewGreetingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterviewGreetingComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InterviewGreetingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
