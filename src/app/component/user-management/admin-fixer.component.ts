import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-admin-fixer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="admin-fixer container mt-5">
      <div class="card shadow">
        <div class="card-header bg-primary text-white">
          <h3>Admin Access Fixer</h3>
        </div>
        <div class="card-body">
          <div class="alert alert-info">
            <i class="fas fa-info-circle me-2"></i>
            This utility helps you fix admin access issues. You need to be logged in.
          </div>
          
          <div class="row mb-4">
            <div class="col-12">
              <p><strong>Current User:</strong> {{ currentUserEmail || 'Not logged in' }}</p>
              <p><strong>User ID:</strong> {{ currentUserId || 'Not available' }}</p>
              <p><strong>Admin Status:</strong> {{ isAdmin ? 'Admin' : 'Not Admin' }}</p>
            </div>
          </div>
          
          <form [formGroup]="userForm" (ngSubmit)="updateUser()" *ngIf="currentUserId">
            <div class="mb-3">
              <label class="form-label">Role:</label>
              <select formControlName="role" class="form-select">
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
              </select>
            </div>
            
            <div class="d-grid gap-2 d-md-flex">
              <button type="submit" class="btn btn-primary me-md-2" [disabled]="userForm.invalid">
                Update Role
              </button>
              <button type="button" class="btn btn-success" (click)="forceAdminRole()">
                Force Admin Role
              </button>
            </div>
          </form>
          
          <div *ngIf="!currentUserId" class="alert alert-warning mt-3">
            <i class="fas fa-exclamation-triangle me-2"></i>
            You must be logged in to use this utility.
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-fixer {
      max-width: 800px;
    }
  `]
})
export class AdminFixerComponent implements OnInit {
  currentUserEmail: string | null = null;
  currentUserId: string | null = null;
  isAdmin = false;
  userForm: FormGroup;
  
  constructor(
    private authService: AuthService,
    private firestore: AngularFirestore,
    private toastr: ToastrService,
    private fb: FormBuilder
  ) {
    this.userForm = this.fb.group({
      role: ['', Validators.required]
    });
  }
  
  ngOnInit(): void {
    this.authService.user$.pipe(take(1)).subscribe(user => {
      if (user) {
        this.currentUserEmail = user.email;
        this.currentUserId = user.uid;
        this.isAdmin = user.role?.toLowerCase() === 'admin';
        
        // Set initial form value
        this.userForm.patchValue({
          role: user.role || 'user'
        });
      }
    });
  }
  
  updateUser(): void {
    if (!this.currentUserId) {
      this.toastr.error('No user logged in');
      return;
    }
    
    const role = this.userForm.get('role')?.value;
    
    this.firestore.doc(`users/${this.currentUserId}`).update({ role })
      .then(() => {
        this.toastr.success(`Role updated to ${role}`);
        // Refresh admin status
        this.isAdmin = role?.toLowerCase() === 'admin';
      })
      .catch(error => {
        this.toastr.error('Error updating role');
        console.error('Error updating role:', error);
      });
  }
  
  forceAdminRole(): void {
    if (!this.currentUserId) {
      this.toastr.error('User ID not available. Please make sure you are logged in.');
      return;
    }

    console.log('Setting admin role for user:', this.currentUserId);
    
    // Direct Firestore update as fallback
    this.firestore.doc(`users/${this.currentUserId}`).update({ 
      role: 'admin' 
    }).then(() => {
      console.log('Admin role set via direct Firestore update');
      this.toastr.success('Admin role set successfully via direct method');
      this.isAdmin = true;
      this.userForm.patchValue({ role: 'admin' });
    }).catch(error => {
      console.error('Error setting admin role via direct method:', error);
      
      // Try through service as backup
      this.authService.setCurrentUserAsAdmin().subscribe(success => {
        if (success) {
          this.toastr.success('Admin role set successfully');
          this.isAdmin = true;
          this.userForm.patchValue({ role: 'admin' });
        } else {
          this.toastr.error('Failed to set admin role');
        }
      });
    });
  }
} 