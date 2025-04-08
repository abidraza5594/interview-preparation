import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoogleAdComponent } from './google-ad.component';

describe('GoogleAdComponent', () => {
  let component: GoogleAdComponent;
  let fixture: ComponentFixture<GoogleAdComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoogleAdComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GoogleAdComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
