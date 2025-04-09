// auth.service.ts

import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { NavigationExtras, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, Observable, from, of, take, switchMap, tap } from 'rxjs';
import Swal from 'sweetalert2';
import { GoogleAuthProvider, GithubAuthProvider, FacebookAuthProvider, user} from '@angular/fire/auth'
import { map, catchError } from 'rxjs/operators';

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  loggedIn: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  isLoggedInGuard: boolean = false;
  user$: Observable<User | null>;

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

    this.user$ = this.afAuth.authState.pipe(
      switchMap(user => {
        if (user) {
          return this.afs.doc<User>(`users/${user.uid}`).valueChanges().pipe(
            map(userData => ({ 
              uid: user.uid, 
              email: user.email || '', 
              displayName: user.displayName || '',
              photoURL: user.photoURL || '',
              ...userData 
            } as User))
          );
        } else {
          return of(null);
        }
      })
    );
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
      
      // Set token in localStorage
      localStorage.setItem('token', await user?.getIdToken() || '');
      
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
      
      // Set token in localStorage
      localStorage.setItem('token', await user?.getIdToken() || '');
      
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
      if (user) {
        // Get the full user object from Firestore
        this.afs.doc(`users/${user.uid}`).valueChanges().subscribe(
          (firestoreUser: any) => {
            // Merge Firebase Auth user with Firestore user data
            const fullUser = {
              ...user.toJSON(),
              ...firestoreUser
            };
            
            console.log('Loaded user with complete profile:', fullUser);
            localStorage.setItem('user', JSON.stringify(fullUser));
          },
          error => {
            console.error('Error loading user data from Firestore:', error);
            // Still store basic user info if Firestore data fails
            localStorage.setItem('user', JSON.stringify(user));
          }
        );
      } else {
        localStorage.removeItem('user');
      }
    });
  }

  logOut() {
    this.afAuth.signOut().then(() => {
      this.toaster.success('Logout Successful.');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      this.loggedIn.next(false);
      this.isLoggedInGuard = false;
      this.router.navigate(['/']);
    });
  }

  isAuthenticated(): BehaviorSubject<boolean> {
    // Check token and update loggedIn status properly
    const token = localStorage.getItem('token');
    const storedUserString = localStorage.getItem('user');
    
    // Sync the isLoggedInGuard state with actual logged in state
    if (token && storedUserString) {
      try {
        const storedUserObject = JSON.parse(storedUserString);
        if (storedUserObject) {
          this.loggedIn.next(true);
          this.isLoggedInGuard = true;
        }
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
    
    return this.loggedIn;
  }

  getCurrentUser(): Observable<User | null> {
    return this.user$;
  }

  loginSweetAlert(frontend: any): void {
    const isUserLoggedIn = this.checkIfUserLoggedIn();
    if (isUserLoggedIn) {
      this.navigateToDetailsPage(frontend);
    } else {
      this.showLoginRequiredAlert();
    }
  }
  navigateToDetailsPage(frontend: any): void {
    // Check if post data exists
    if (frontend && frontend.id) {
      // Create a permalink from the title if available
      if (frontend.data && frontend.data.title) {
        // Convert title to URL-friendly format
        const permalink = this.createPermalink(frontend.data.title) + '-' + frontend.id;
        // Navigate to the permalink route
        this.router.navigate([`/${permalink}`]);
      } else {
        // Fallback to just the ID if title is not available
        this.router.navigate([`/${frontend.id}`]);
      }
    } else {
      console.error('Invalid post data:', frontend);
      this.toaster.error('Error navigating to post');
    }
  }
  
  // Helper method to create a permalink from a title
  createPermalink(title: string): string {
    if (!title) return '';
    
    // Convert to lowercase, replace spaces with hyphens, and remove special characters
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Replace multiple hyphens with a single hyphen
      .trim();                  // Trim leading/trailing spaces
  }
  checkIfUserLoggedIn(): boolean {
    const token = localStorage.getItem('token');
    const storedUserString = localStorage.getItem('user');
    
    // Check if both token and user exist in localStorage
    if (!token || !storedUserString) {
      return false;
    }
    
    try {
      const storedUserObject = JSON.parse(storedUserString);
      return !!storedUserObject; // Return true if user object exists and is valid
    } catch (e) {
      console.error('Error parsing user data:', e);
      return false;
    }
  }   
  showLoginRequiredAlert(): void {
    Swal.fire({
      title: 'Login Required',
      text: 'Please login to view details.',
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Login',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        this.router.navigate(['/auth']);
      } else {
        // You can add additional logic or leave it empty if not needed
      }
    });
  }
  //sign in with google
  googleSignIn() {
    return this.afAuth.signInWithPopup(new GoogleAuthProvider).then(user => {
      this.router.navigate(['/']);
      this.toaster.success('Login Successfully');
      localStorage.setItem('user', JSON.stringify(user));
      
      // Set token in localStorage for Google sign-in
      if (user && user.user) {
        user.user.getIdToken().then(token => {
          localStorage.setItem('token', token);
        });
        
        // Save user data to Firestore if it doesn't exist
        const uid = user.user.uid;
        const userData = {
          uid: uid,
          email: user.user.email || '',
          displayName: user.user.displayName || 'Google User',
          photoURL: user.user.photoURL || '',
          role: 'user', // Default role
          isActive: true,
          createdAt: new Date(),
          lastLogin: new Date(),
          provider: 'google'
        };
        
        // Check if user exists in Firestore
        this.afs.doc(`users/${uid}`).get().subscribe(docSnapshot => {
          if (!docSnapshot.exists) {
            // User doesn't exist, create new user document
            this.afs.doc(`users/${uid}`).set(userData)
              .then(() => {
                console.log('New Google user added to Firestore');
              })
              .catch(error => {
                console.error('Error adding Google user to Firestore:', error);
              });
          } else {
            // User exists, update lastLogin
            const data = docSnapshot.data() as any;
            this.afs.doc(`users/${uid}`).update({
              lastLogin: new Date(),
              displayName: userData.displayName,
              photoURL: userData.photoURL
            }).then(() => {
              console.log('User login time updated');
            });
          }
        });
      }
    }, err => {
      this.toaster.error(err.message);
    })
  }

  // Reset password functionality
  resetPassword(email: string): Promise<void> {
    return this.afAuth.sendPasswordResetEmail(email)
      .then(() => {
        this.toaster.success('Password reset email sent. Check your inbox.');
      })
      .catch(error => {
        this.toaster.error('Error sending password reset email: ' + error.message);
        throw error;
      });
  }

  /**
   * Check if current user has admin role
   * @returns Observable<boolean> True if user is admin
   */
  isAdmin(): Observable<boolean> {
    return this.user$.pipe(
      map(user => {
        if (!user) return false;
        
        // Check role with case insensitivity
        const userRole = user.role || '';
        
        // Log for debugging
        console.log('Role check:', { 
          uid: user.uid, 
          userRole, 
          email: user.email,
          roleType: typeof userRole
        });
        
        // Robust role checking
        if (typeof userRole === 'string') {
          // String comparison with lowercase
          return userRole.toLowerCase() === 'admin';
        } else if (userRole && typeof userRole === 'object') {
          // Handle case if role is somehow stored as object
          return String(userRole).toLowerCase() === 'admin';
        }
          
        return false;
      }),
      catchError(error => {
        console.error('Error checking admin status:', error);
        return of(false);
      })
    );
  }
  
  /**
   * Update user role in Firestore
   * @param uid User ID
   * @param role New role
   * @returns Observable indicating success
   */
  updateUserRole(uid: string, role: string): Observable<void> {
    console.log(`Updating user ${uid} role to ${role}`);
    return from(this.afs.doc(`users/${uid}`).update({ role })).pipe(
      tap(() => console.log(`Updated user ${uid} role to ${role}`)),
      catchError(error => {
        console.error('Error updating user role:', error);
        throw error;
      })
    );
  }

  /**
   * Set current user as admin directly (for emergencies/debugging)
   * @returns Observable<boolean> Success status
   */
  setCurrentUserAsAdmin(): Observable<boolean> {
    return this.user$.pipe(
      take(1),
      switchMap(user => {
        if (!user || !user.uid) {
          console.error('No user logged in');
          return of(false);
        }
        
        const userId = user.uid;
        console.log('Setting admin role for user:', userId);
        
        // First check in the console for debugging
        console.log('Current user state before update:', user);
        
        return from(this.afs.doc(`users/${userId}`).update({ 
          role: 'admin',
          isAdmin: true // Add extra field for redundancy
        })).pipe(
          map(() => {
            console.log('Admin role set successfully for', userId);
            return true;
          }),
          catchError(error => {
            console.error('Error setting admin role:', error);
            
            // Try to create the document if it doesn't exist (set instead of update)
            return from(this.afs.doc(`users/${userId}`).set({
              role: 'admin',
              isAdmin: true,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL
            }, { merge: true })).pipe(
              map(() => {
                console.log('Admin role set with merge for', userId);
                return true;
              }),
              catchError(err => {
                console.error('Final error setting admin role:', err);
                return of(false);
              })
            );
          })
        );
      })
    );
  }
}
