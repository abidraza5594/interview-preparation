// auth.component.ts

import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';


@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent implements OnInit {
  signUpForm!: FormGroup;
  signInForm!: FormGroup;  
  formData: { name: string, email: string, password: string } = { name: '', email: '', password: '' };
  isActive: boolean = false;

  constructor(private fb: FormBuilder, private authService: AuthService,private router:Router) {}

  ngOnInit(): void {
    this.signUpForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    this.signInForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  async onSignUpFormSubmit() {
    const { name, email, password } = this.signUpForm.value;

    try {
      await this.authService.signup(name, email, password);
      console.log('Sign Up successful');
      // Reset the form after successful signup
      this.signUpForm.reset();
    } catch (error) {
      console.error('Sign Up failed', error);
      // Handle signup error (display message to the user, etc.)
    }
  }

  async onSignInFormSubmit() {
    const { email, password } = this.signInForm.value;

    try {
      await this.authService.login(email, password);
      console.log('Sign In successful');
      // Reset the form after successful login
      this.signInForm.reset();
    } catch (error) {
      console.error('Sign In failed', error);
      // Handle login error (display message to the user, etc.)
    }
  }

  activateContainer() {
    this.isActive = true;
  }

  deactivateContainer() {
    this.isActive = false;
  }

  signInWithGoogle() {
    this.authService.googleSignIn();
  }

  onContainerClick() {
    this.router.navigate(["/"])
  }
  
}
