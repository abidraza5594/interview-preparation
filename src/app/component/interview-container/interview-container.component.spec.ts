import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewContainerComponent } from './interview-container.component';

describe('InterviewContainerComponent', () => {
  let component: InterviewContainerComponent;
  let fixture: ComponentFixture<InterviewContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterviewContainerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InterviewContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
