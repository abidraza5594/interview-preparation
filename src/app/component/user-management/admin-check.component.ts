import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Component({
  selector: 'app-admin-check',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="admin-checker container mt-5">
      <div class="card shadow">
        <div class="card-header bg-primary text-white">
          <h3>Admin Access Checker</h3>
        </div>
        <div class="card-body">
          <div *ngIf="loading" class="text-center">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Checking admin status...</p>
          </div>
          
          <div *ngIf="!loading">
            <div class="mb-4">
              <h4>Basic Info</h4>
              <p><strong>User ID:</strong> {{ userId || 'Not logged in' }}</p>
              <p><strong>Email:</strong> {{ userEmail || 'Not available' }}</p>
              <p><strong>Is Admin (from service):</strong> {{ isAdmin ? 'Yes' : 'No' }}</p>
              <p><strong>Is Admin (from Firestore):</strong> {{ firestoreRole }}</p>
              <p><strong>Guards Active:</strong> {{ isLoggedInGuard ? 'Yes' : 'No' }}</p>
            </div>
            
            <div class="mb-4">
              <h4>Diagnostics</h4>
              <p><strong>Local Storage Token:</strong> {{ hasToken ? 'Yes' : 'No' }}</p>
              <p><strong>Local Storage User:</strong> {{ hasUserData ? 'Yes' : 'No' }}</p>
              <p><strong>Token Valid:</strong> {{ isTokenValid ? 'Yes' : 'No' }}</p>
            </div>
            
            <div class="d-grid gap-2">
              <button class="btn btn-primary" (click)="checkAdminStatus()">
                Recheck Admin Status
              </button>
              <button class="btn btn-info" (click)="forceAuthStateRefresh()">
                Force Auth State Refresh
              </button>
              <button class="btn btn-warning" (click)="resetLocalStorage()">
                Reset Local Storage
              </button>
              <button class="btn btn-success" (click)="directAdminSet()">
                Direct Admin Set
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-checker {
      max-width: 800px;
    }
  `]
})
export class AdminCheckComponent implements OnInit {
  userId: string | null = null;
  userEmail: string | null = null;
  isAdmin = false;
  firestoreRole = 'Loading...';
  isLoggedInGuard = false;
  loading = true;
  hasToken = false;
  hasUserData = false;
  isTokenValid = false;
  
  constructor(
    private authService: AuthService,
    private firestore: AngularFirestore,
    private toastr: ToastrService
  ) {}
  
  ngOnInit(): void {
    this.checkAdminStatus();
  }
  
  checkAdminStatus(): void {
    this.loading = true;
    
    // Check localStorage
    this.hasToken = !!localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    this.hasUserData = !!userData;
    
    // Basic token validation (existence only, not expiration)
    this.isTokenValid = this.hasToken;
    
    // Get auth state
    this.isLoggedInGuard = this.authService.isLoggedInGuard;
    
    // Get user details
    this.authService.getCurrentUser().subscribe(user => {
      if (user) {
        this.userId = user.uid;
        this.userEmail = user.email;
        
        // Check the role in Firestore directly
        this.firestore.doc(`users/${user.uid}`).valueChanges()
          .subscribe((userData: any) => {
            if (userData && userData.role) {
              this.firestoreRole = `${userData.role} (${typeof userData.role})`;
            } else {
              this.firestoreRole = 'No role found';
            }
            
            // Check admin status from service
            this.authService.isAdmin().subscribe(isAdmin => {
              this.isAdmin = isAdmin;
              this.loading = false;
            });
          });
      } else {
        this.firestoreRole = 'Not logged in';
        this.loading = false;
      }
    });
  }
  
  forceAuthStateRefresh(): void {
    // Force a recheck of authentication
    this.authService.isAuthenticated();
    this.toastr.info('Auth state refresh triggered');
    setTimeout(() => this.checkAdminStatus(), 500);
  }
  
  resetLocalStorage(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.toastr.warning('Local storage cleared. You will need to login again.');
    setTimeout(() => window.location.href = '/auth', 1500);
  }
  
  directAdminSet(): void {
    if (!this.userId) {
      this.toastr.error('You must be logged in to set admin role');
      return;
    }
    
    // Direct Firestore update
    this.firestore.doc(`users/${this.userId}`).update({
      role: 'admin',
      isAdmin: true
    }).then(() => {
      this.toastr.success('Admin role set directly in Firestore');
      setTimeout(() => this.checkAdminStatus(), 500);
    }).catch(error => {
      console.error('Error setting admin role:', error);
      this.toastr.error('Error setting admin role: ' + error.message);
    });
  }
} 