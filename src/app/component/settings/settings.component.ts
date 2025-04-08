import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import firebase from 'firebase/compat/app';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    FormsModule,
    RouterModule
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  passwordForm: FormGroup;
  preferencesForm: FormGroup;
  user: any = null;
  isLoading = true;
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private toastr: ToastrService,
    private router: Router
  ) {
    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validator: this.checkPasswords });

    this.preferencesForm = this.fb.group({
      emailNotifications: [true],
      darkMode: [false],
      language: ['english']
    });
  }

  ngOnInit(): void {
    this.loadUserData();
  }

  loadUserData(): void {
    this.isLoading = true;
    this.afAuth.authState.subscribe(user => {
      if (user) {
        this.user = user;
        
        // Get user preferences from Firestore
        this.firestore.doc(`users/${user.uid}`).valueChanges().subscribe((userData: any) => {
          if (userData && userData.preferences) {
            this.preferencesForm.patchValue({
              emailNotifications: userData.preferences.emailNotifications ?? true,
              darkMode: userData.preferences.darkMode ?? false,
              language: userData.preferences.language ?? 'english'
            });
          }
          
          this.isLoading = false;
        });
      } else {
        this.isLoading = false;
      }
    });
  }

  checkPasswords(group: FormGroup) {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    
    return newPassword === confirmPassword ? null : { notMatching: true };
  }

  savePreferences(): void {
    if (!this.user) {
      this.toastr.error('You must be logged in to save preferences');
      return;
    }
    
    const preferences = this.preferencesForm.value;
    
    this.firestore.doc(`users/${this.user.uid}`).update({
      preferences: preferences,
      updatedAt: new Date()
    })
      .then(() => {
        this.toastr.success('Preferences saved successfully');
        
        // Apply dark mode if selected
        if (preferences.darkMode) {
          document.body.classList.add('dark-mode');
        } else {
          document.body.classList.remove('dark-mode');
        }
      })
      .catch((error: Error) => {
        this.toastr.error('Error saving preferences');
        console.error('Error saving preferences:', error);
      });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.toastr.error('Please fill all password fields correctly');
      return;
    }
    
    const { currentPassword, newPassword } = this.passwordForm.value;
    
    // Reauthenticate user
    const credential = this.afAuth.signInWithEmailAndPassword(this.user.email, currentPassword)
      .then(() => {
        // Update password
        return this.user.updatePassword(newPassword);
      })
      .then(() => {
        this.toastr.success('Password updated successfully');
        this.passwordForm.reset();
      })
      .catch((error: firebase.FirebaseError) => {
        if (error.code === 'auth/wrong-password') {
          this.toastr.error('Current password is incorrect');
        } else {
          this.toastr.error('Error updating password');
          console.error('Error updating password:', error);
        }
      });
  }

  deleteAccount(): void {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      // Delete user data from Firestore
      this.firestore.doc(`users/${this.user.uid}`).delete()
        .then(() => {
          // Delete user authentication
          return this.user.delete();
        })
        .then(() => {
          this.toastr.success('Account deleted successfully');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          this.router.navigate(['/']);
        })
        .catch((error: firebase.FirebaseError) => {
          this.toastr.error('Error deleting account. You may need to reauthenticate.');
          console.error('Error deleting account:', error);
        });
    }
  }

  togglePasswordVisibility(field: string): void {
    if (field === 'current') {
      this.showCurrentPassword = !this.showCurrentPassword;
    } else if (field === 'new') {
      this.showNewPassword = !this.showNewPassword;
    } else if (field === 'confirm') {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }
}
