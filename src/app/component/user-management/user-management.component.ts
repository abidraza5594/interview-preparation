import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { ToastrService } from 'ngx-toastr';
import { Observable, finalize } from 'rxjs';
import { map } from 'rxjs/operators';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
declare var bootstrap: any;

interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: string;
  createdAt: any;
  lastLogin?: any;
  isActive: boolean;
}

interface BlogPost {
  id?: string;
  title: string;
  content: string;
  category: {
    Category: string;
  };
  postImgPath: string;
  featured: boolean;
  createdAt: any;
  updatedAt: any;
  permalink: string;
  views: number;
  likes: number;
}

interface PracticeQuestion {
  id?: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  solution: string;
  hints?: string;
  createdAt: any;
  updatedAt: any;
}

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {
  users$: Observable<User[]>;
  filteredUsers$: Observable<User[]>;
  searchQuery: string = '';
  
  userForm: FormGroup;
  blogPostForm: FormGroup;
  practiceQuestionForm: FormGroup;
  
  isEditing: boolean = false;
  currentUserId: string = '';
  
  currentUser: any;
  isAdmin: boolean = false;
  
  selectedFile: File | null = null;
  uploadPercent: Observable<number | undefined> | null = null;
  downloadURL: Observable<string> | null = null;
  
  blogPostModal: any = null;
  practiceQuestionModal: any = null;

  constructor(
    private firestore: AngularFirestore,
    private auth: AngularFireAuth,
    private storage: AngularFireStorage,
    private toastr: ToastrService,
    private fb: FormBuilder
  ) {
    this.userForm = this.fb.group({
      displayName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      role: ['user'],
      isActive: [true]
    });
    
    this.blogPostForm = this.fb.group({
      title: ['', Validators.required],
      category: ['', Validators.required],
      content: ['', Validators.required],
      featured: [false]
    });
    
    this.practiceQuestionForm = this.fb.group({
      title: ['', Validators.required],
      category: ['', Validators.required],
      difficulty: ['Medium'],
      description: ['', Validators.required],
      solution: ['', Validators.required],
      hints: ['']
    });
    
    this.users$ = this.firestore.collection<User>('users')
      .snapshotChanges()
      .pipe(
        map(actions => actions.map(a => {
          const data = a.payload.doc.data() as Omit<User, 'uid'>;
          const uid = a.payload.doc.id;
          return { uid, ...data };
        }))
      );
      
    this.filteredUsers$ = this.users$;
  }

  ngOnInit(): void {
    this.auth.user.subscribe(user => {
      if (user) {
        this.currentUser = user;
        this.checkAdminStatus(user.uid);
      }
    });
    
    // Initialize modals after the DOM is fully loaded
    setTimeout(() => {
      try {
        const blogPostModalEl = document.getElementById('blogPostModal');
        const practiceQuestionModalEl = document.getElementById('practiceQuestionModal');
        
        if (blogPostModalEl) {
          this.blogPostModal = new bootstrap.Modal(blogPostModalEl);
        } else {
          console.error('Blog post modal element not found');
        }
        
        if (practiceQuestionModalEl) {
          this.practiceQuestionModal = new bootstrap.Modal(practiceQuestionModalEl);
        } else {
          console.error('Practice question modal element not found');
        }
      } catch (error) {
        console.error('Error initializing modals:', error);
      }
    }, 500);
  }
  
  checkAdminStatus(uid: string): void {
    this.firestore.doc(`users/${uid}`).valueChanges().subscribe((userData: any) => {
      this.isAdmin = userData?.role === 'admin';
      
      if (!this.isAdmin) {
        this.toastr.error('You do not have permission to access this page');
      }
    });
  }
  
  applyFilter(): void {
    if (!this.searchQuery.trim()) {
      this.filteredUsers$ = this.users$;
      return;
    }
    
    const query = this.searchQuery.toLowerCase();
    this.filteredUsers$ = this.users$.pipe(
      map(users => users.filter(user => 
        user.email.toLowerCase().includes(query) || 
        (user.displayName && user.displayName.toLowerCase().includes(query))
      ))
    );
  }
  
  editUser(user: User): void {
    this.isEditing = true;
    this.currentUserId = user.uid;
    
    this.userForm.patchValue({
      displayName: user.displayName || '',
      email: user.email,
      role: user.role || 'user',
      isActive: user.isActive
    });
    
    // Disable email field when editing
    this.userForm.get('email')?.disable();
  }
  
  cancelEdit(): void {
    this.isEditing = false;
    this.currentUserId = '';
    
    this.userForm.reset({
      role: 'user',
      isActive: true
    });
    
    // Enable email field for new user
    this.userForm.get('email')?.enable();
  }
  
  saveUser(): void {
    if (this.userForm.invalid) {
      this.toastr.error('Please fill all required fields correctly');
      return;
    }
    
    const userData = {
      ...this.userForm.value,
      updatedAt: new Date()
    };
    
    if (this.isEditing) {
      // Update existing user
      this.firestore.doc(`users/${this.currentUserId}`).update(userData)
        .then(() => {
          this.toastr.success('User updated successfully');
          this.cancelEdit();
        })
        .catch(error => {
          this.toastr.error('Error updating user');
          console.error('Error updating user:', error);
        });
    } else {
      // Check if email already exists
      this.firestore.collection('users', ref => 
        ref.where('email', '==', userData.email)
      ).get().subscribe(snapshot => {
        if (!snapshot.empty) {
          this.toastr.error('A user with this email already exists');
          return;
        }
        
        // Create new user with Firebase Auth
        this.auth.createUserWithEmailAndPassword(userData.email, 'tempPassword123')
          .then(result => {
            if (result.user) {
              // Send password reset email
              this.auth.sendPasswordResetEmail(userData.email);
              
              // Add user to Firestore
              this.firestore.doc(`users/${result.user.uid}`).set({
                ...userData,
                createdAt: new Date(),
                createdBy: this.currentUser.uid
              })
                .then(() => {
                  this.toastr.success('User created successfully');
                  this.cancelEdit();
                })
                .catch(error => {
                  this.toastr.error('Error creating user document');
                  console.error('Error creating user document:', error);
                });
            }
          })
          .catch(error => {
            this.toastr.error('Error creating user: ' + error.message);
            console.error('Error creating user:', error);
          });
      });
    }
  }
  
  toggleUserStatus(user: User): void {
    const newStatus = !user.isActive;
    
    this.firestore.doc(`users/${user.uid}`).update({
      isActive: newStatus,
      updatedAt: new Date()
    })
      .then(() => {
        this.toastr.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
      })
      .catch(error => {
        this.toastr.error('Error updating user status');
        console.error('Error updating user status:', error);
      });
  }
  
  openBlogPostModal(): void {
    if (!this.blogPostModal) {
      const modalEl = document.getElementById('blogPostModal');
      if (modalEl) {
        this.blogPostModal = new bootstrap.Modal(modalEl);
      } else {
        this.toastr.error('Could not initialize blog post modal');
        return;
      }
    }
    
    this.blogPostForm.reset({
      featured: false
    });
    this.selectedFile = null;
    this.blogPostModal.show();
  }
  
  openPracticeQuestionModal(): void {
    if (!this.practiceQuestionModal) {
      const modalEl = document.getElementById('practiceQuestionModal');
      if (modalEl) {
        this.practiceQuestionModal = new bootstrap.Modal(modalEl);
      } else {
        this.toastr.error('Could not initialize practice question modal');
        return;
      }
    }
    
    this.practiceQuestionForm.reset({
      difficulty: 'Medium'
    });
    this.practiceQuestionModal.show();
  }
  
  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0] ?? null;
  }
  
  saveBlogPost(): void {
    if (this.blogPostForm.invalid) {
      this.toastr.error('Please fill in all required fields');
      return;
    }
    
    const formValue = this.blogPostForm.value;
    
    // Generate permalink from title
    const permalink = formValue.title
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '-');
    
    const timestamp = new Date();
    
    const blogPost: BlogPost = {
      title: formValue.title,
      content: formValue.content,
      category: {
        Category: formValue.category
      },
      postImgPath: '',
      featured: formValue.featured,
      createdAt: timestamp,
      updatedAt: timestamp,
      permalink: permalink,
      views: 0,
      likes: 0
    };
    
    if (this.selectedFile) {
      const filePath = `blog-images/${new Date().getTime()}_${this.selectedFile.name}`;
      const fileRef = this.storage.ref(filePath);
      const task = this.storage.upload(filePath, this.selectedFile);
      
      // Get upload progress
      this.uploadPercent = task.percentageChanges();
      
      task.snapshotChanges().pipe(
        finalize(() => {
          fileRef.getDownloadURL().subscribe(url => {
            blogPost.postImgPath = url;
            this.saveBlogPostToFirestore(blogPost);
          });
        })
      ).subscribe();
    } else {
      // Use a default image if none is provided
      blogPost.postImgPath = 'assets/images/default-post.jpg';
      this.saveBlogPostToFirestore(blogPost);
    }
  }
  
  saveBlogPostToFirestore(blogPost: BlogPost): void {
    this.firestore.collection('posts').add(blogPost)
      .then(() => {
        this.toastr.success('Blog post created successfully');
        this.blogPostModal.hide();
        this.blogPostForm.reset();
      })
      .catch(error => {
        this.toastr.error('Error creating blog post: ' + error.message);
      });
  }
  
  savePracticeQuestion(): void {
    if (this.practiceQuestionForm.invalid) {
      this.toastr.error('Please fill in all required fields');
      return;
    }
    
    const formValue = this.practiceQuestionForm.value;
    const timestamp = new Date();
    
    const practiceQuestion: PracticeQuestion = {
      title: formValue.title,
      description: formValue.description,
      category: formValue.category,
      difficulty: formValue.difficulty,
      solution: formValue.solution,
      hints: formValue.hints || '',
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    this.firestore.collection('practice-questions').add(practiceQuestion)
      .then(() => {
        this.toastr.success('Practice question created successfully');
        this.practiceQuestionModal.hide();
        this.practiceQuestionForm.reset({
          difficulty: 'Medium'
        });
      })
      .catch(error => {
        this.toastr.error('Error creating practice question: ' + error.message);
      });
  }
} 