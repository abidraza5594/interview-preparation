// contact-us.component.ts
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommentsService } from '../../services/comments.service';

@Component({
  selector: 'app-contact-us',
  templateUrl: './contact-us.component.html',
  styleUrls: ['./contact-us.component.css']
})
export class ContactUsComponent {
  contactForm: FormGroup;
  messageSent: boolean = false;
  formSubmitted: boolean = false; // New property to track form submission

  constructor(private fb: FormBuilder,
    private commentService:CommentsService) {
    this.contactForm = this.fb.group({
      message: [''],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]]
    });
  }

  submitForm() {
    this.formSubmitted = true; // Set formSubmitted to true when the form is submitted

    if (this.contactForm.valid) {
      // Your logic for sending the form data goes here
      this.commentService.saveContactUS(this.contactForm.value)
      this.messageSent = true;
      this.contactForm.reset();
      document.body.classList.add('sent');
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
  }
}
