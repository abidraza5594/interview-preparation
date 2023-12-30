import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
@Component({
  selector: 'app-contact-us',
  templateUrl: './contact-us.component.html',
  styleUrls: ['./contact-us.component.css']
})
export class ContactUsComponent {
  contactForm: FormGroup;
  messageSent: boolean = false;
  constructor(private fb: FormBuilder) {
    this.contactForm = this.fb.group({
      message: [''],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]]
    });
  }
  submitForm() {
    this.messageSent = true;
    this.contactForm.reset();
    document.body.classList.add('sent');
  }
}