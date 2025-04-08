// contact-us.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommentsService } from '../../services/comments.service';
import { ThemeService } from '../../services/theme.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-contact-us',
  templateUrl: './contact-us.component.html',
  styleUrls: ['./contact-us.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactUsComponent implements OnInit, OnDestroy {
  contactForm: FormGroup;
  messageSent: boolean = false;
  formSubmitted: boolean = false;
  isDarkMode: boolean = false;
  private themeSubscription: Subscription | undefined;

  constructor(
    private fb: FormBuilder,
    private commentService: CommentsService,
    private themeService: ThemeService,
    private cdr: ChangeDetectorRef
  ) {
    this.contactForm = this.fb.group({
      message: [''],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {
    // Get initial theme state
    this.isDarkMode = this.themeService.isDarkMode();
    
    // Subscribe to theme changes
    this.themeSubscription = this.themeService.darkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    // Clean up subscription
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
    }
  }

  submitForm() {
    this.formSubmitted = true;

    if (this.contactForm.valid) {
      this.commentService.saveContactUS(this.contactForm.value);
      this.messageSent = true;
      this.contactForm.reset();
      document.body.classList.add('sent');
      this.cdr.markForCheck();
    } else {
      this.markFormGroupTouched(this.contactForm);
    }
  }

  shouldShowError(controlName: string): boolean {
    const control = this.contactForm.get(controlName);
    return !!control && (control.invalid || control.hasError('email')) && (control.touched || this.formSubmitted);
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
    this.cdr.markForCheck();
  }
}
