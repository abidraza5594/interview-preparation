import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpeechControlComponent } from './speech-control.component';

describe('SpeechControlComponent', () => {
  let component: SpeechControlComponent;
  let fixture: ComponentFixture<SpeechControlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpeechControlComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SpeechControlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
