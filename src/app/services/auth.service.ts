// auth.service.ts

import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  loggedIn: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  isLoggedInGuard: boolean = false;

  constructor(
    private afAuth: AngularFireAuth,
    private toaster: ToastrService,
    private router: Router,
    private afs: AngularFirestore
  ) {
    // Check initial authentication state
    this.afAuth.authState.subscribe(user => {
      this.loggedIn.next(!!user); // Update loggedIn state
      this.isLoggedInGuard = !!user; // Update isLoggedInGuard state
    });
  }

  async signup(name: string, email: string, password: string) {
    try {
      const userCredential = await this.afAuth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Update user profile with the provided name
      await this.updateUserProfile(user, name);

      this.toaster.success('Account created successfully');
      this.loadUser();
      this.loggedIn.next(true);
      this.isLoggedInGuard = true;
      this.router.navigate(['/']);
    } catch (error: any) {
      this.toaster.error('Error creating account: ' + error);
      console.error(error);
      throw error; // Rethrow the error to handle it in the component
    }
  }

  async login(email: string, password: string) {
    try {
      const userCredential = await this.afAuth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;

      this.toaster.success('Login Successfully');
      this.loadUser();
      this.loggedIn.next(true);
      this.isLoggedInGuard = true;
      this.router.navigate(['/']);
    } catch (error) {
      this.toaster.error('Invalid Credentials');
      console.error(error);
      throw error; // Rethrow the error to handle it in the component
    }
  }

  private async updateUserProfile(user: any, name: any) {
    if (user) {
      // Update the user profile with the provided name
      await user.updateProfile({
        displayName: name,
      });

      // Additional information can be stored in Firebase Realtime Database or Firestore
      // For example, storing user name in Firestore
      this.afs.collection('users').doc(user.uid).set({ displayName: name });
    }
  }

  loadUser() {
    this.afAuth.authState.subscribe(user => {
      localStorage.setItem('user', JSON.stringify(user));
    });
  }

  logOut() {
    this.afAuth.signOut().then(() => {
      this.toaster.success('Logout Successful.');
      localStorage.removeItem('user');
      this.loggedIn.next(false);
      this.isLoggedInGuard = false;
      this.router.navigate(['/login']);
    });
  }

  isAuthenticated(): BehaviorSubject<boolean> {
    return this.loggedIn;
  }

  getCurrentUser(): any {
    return this.afAuth.currentUser;
  }
}
