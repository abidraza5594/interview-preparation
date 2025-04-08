import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    FormsModule,
    RouterModule
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  profileForm: FormGroup;
  blogForm: FormGroup;
  practiceForm: FormGroup;
  user: any = null;
  isLoading = true;
  isEditing = false;
  isAdmin = false;
  userProgress: any = {
    started: 0,
    completed: 0,
    total: 0
  };
  
  // Admin panel variables
  showBlogModal = false;
  showPracticeModal = false;
  selectedFile: File | null = null;
  imageUrl: string = '';
  uploadPercent: number | null = null;
  
  // Blog and practice question lists
  blogs: any[] = [];
  practiceQuestions: any[] = [];
  selectedItem: any = null;
  isEditMode = false;

  constructor(
    private fb: FormBuilder,
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private toastr: ToastrService,
    private storage: AngularFireStorage
  ) {
    this.profileForm = this.fb.group({
      displayName: ['', Validators.required],
      email: [{ value: '', disabled: true }],
      bio: [''],
      phoneNumber: [''],
      location: ['']
    });
    
    this.blogForm = this.fb.group({
      title: ['', Validators.required],
      category: ['', Validators.required],
      excerpt: ['', Validators.required],
      content: ['', Validators.required],
      featuredImage: [''],
      isFeatured: [false]
    });
    
    this.practiceForm = this.fb.group({
      title: ['', Validators.required],
      category: ['', Validators.required],
      difficulty: ['medium', Validators.required],
      question: ['', Validators.required],
      answer: ['', Validators.required],
      hints: ['']
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
        
        // Get additional user data from Firestore
        this.firestore.doc(`users/${user.uid}`).valueChanges().subscribe((userData: any) => {
          if (userData) {
            this.user = { ...this.user, ...userData };
            this.isAdmin = userData.role === 'admin';
            
            // If user is admin, load blogs and practice questions
            if (this.isAdmin) {
              this.loadBlogs();
              this.loadPracticeQuestions();
            }
            
            // Update form values
            this.profileForm.patchValue({
              displayName: this.user.displayName || '',
              email: this.user.email || '',
              bio: this.user.bio || '',
              phoneNumber: this.user.phoneNumber || '',
              location: this.user.location || ''
            });
          }
          
          this.isLoading = false;
        });
        
        // Get user progress
        this.firestore.collection(`users/${user.uid}/progress`).valueChanges().subscribe((progress: any[]) => {
          if (progress) {
            this.userProgress = {
              started: progress.filter(p => p.status === 'started').length,
              completed: progress.filter(p => p.status === 'completed').length,
              total: 0 // Will be updated when we get questions count
            };
          }
        });
        
        // Get total questions count
        this.firestore.collection('questions').get().subscribe(snapshot => {
          this.userProgress.total = snapshot.size;
        });
      } else {
        this.isLoading = false;
      }
    });
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    
    if (!this.isEditing) {
      // Reset form to original values when canceling edit
      this.profileForm.patchValue({
        displayName: this.user.displayName || '',
        email: this.user.email || '',
        bio: this.user.bio || '',
        phoneNumber: this.user.phoneNumber || '',
        location: this.user.location || ''
      });
    }
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.toastr.error('Please fill all required fields correctly');
      return;
    }
    
    const userData = {
      displayName: this.profileForm.value.displayName,
      bio: this.profileForm.value.bio,
      phoneNumber: this.profileForm.value.phoneNumber,
      location: this.profileForm.value.location,
      updatedAt: new Date()
    };
    
    // Update display name in Firebase Auth
    this.user.updateProfile({
      displayName: userData.displayName
    }).then(() => {
      // Update additional data in Firestore
      this.firestore.doc(`users/${this.user.uid}`).update(userData)
        .then(() => {
          this.toastr.success('Profile updated successfully');
          this.isEditing = false;
          
          // Update local user data
          this.user = { ...this.user, ...userData };
          
          // Update localStorage
          const userString = localStorage.getItem('user');
          if (userString) {
            try {
              const userObj = JSON.parse(userString);
              userObj.user.displayName = userData.displayName;
              localStorage.setItem('user', JSON.stringify(userObj));
            } catch (e) {
              console.error('Error updating local storage:', e);
            }
          }
        })
        .catch((error: Error) => {
          this.toastr.error('Error updating profile');
          console.error('Error updating profile:', error);
        });
    }).catch((error: Error) => {
      this.toastr.error('Error updating display name');
      console.error('Error updating display name:', error);
    });
  }
  
  // Admin panel methods
  loadBlogs(): void {
    this.firestore.collection('posts', ref => ref.orderBy('createdAt', 'desc')).snapshotChanges()
      .subscribe(actions => {
        this.blogs = actions.map(a => {
          const data = a.payload.doc.data() as any;
          const id = a.payload.doc.id;
          return { id, ...data };
        });
      });
  }
  
  loadPracticeQuestions(): void {
    this.firestore.collection('questions', ref => ref.orderBy('createdAt', 'desc')).snapshotChanges()
      .subscribe(actions => {
        this.practiceQuestions = actions.map(a => {
          const data = a.payload.doc.data() as any;
          const id = a.payload.doc.id;
          return { id, ...data };
        });
      });
  }
  
  // Modal methods
  openBlogModal(blog: any = null): void {
    this.showBlogModal = true;
    this.isEditMode = !!blog;
    this.selectedItem = blog;
    
    if (blog) {
      this.blogForm.patchValue({
        title: blog.title || '',
        category: blog.category || '',
        excerpt: blog.excerpt || '',
        content: blog.content || '',
        featuredImage: blog.featuredImage || '',
        isFeatured: blog.isFeatured || false
      });
      this.imageUrl = blog.featuredImage || '';
    } else {
      this.blogForm.reset({
        isFeatured: false
      });
      this.imageUrl = '';
    }
  }
  
  openPracticeModal(question: any = null): void {
    this.showPracticeModal = true;
    this.isEditMode = !!question;
    this.selectedItem = question;
    
    if (question) {
      this.practiceForm.patchValue({
        title: question.title || '',
        category: question.category || '',
        difficulty: question.difficulty || 'medium',
        question: question.question || '',
        answer: question.answer || '',
        hints: question.hints || ''
      });
    } else {
      this.practiceForm.reset({
        difficulty: 'medium'
      });
    }
  }
  
  closeModals(): void {
    this.showBlogModal = false;
    this.showPracticeModal = false;
    this.selectedFile = null;
    this.uploadPercent = null;
    this.blogForm.reset({
      isFeatured: false
    });
    this.practiceForm.reset({
      difficulty: 'medium'
    });
  }
  
  // File upload methods
  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0];
    
    if (this.selectedFile) {
      // Preview image
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imageUrl = e.target.result;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }
  
  uploadImage(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.selectedFile) {
        resolve(this.imageUrl); // Return existing URL if no new file
        return;
      }
      
      const filePath = `blog-images/${Date.now()}_${this.selectedFile.name}`;
      const fileRef = this.storage.ref(filePath);
      const task = this.storage.upload(filePath, this.selectedFile);
      
      // Observe percentage changes
      task.percentageChanges().subscribe(percentage => {
        this.uploadPercent = percentage ? percentage : 0;
      });
      
      // Get notified when the upload completes
      task.snapshotChanges().pipe(
        finalize(() => {
          fileRef.getDownloadURL().subscribe(url => {
            this.imageUrl = url;
            resolve(url);
          }, error => {
            reject(error);
          });
        })
      ).subscribe();
    });
  }
  
  // Save methods
  async saveBlog(): Promise<void> {
    if (this.blogForm.invalid) {
      this.toastr.error('Please fill all required fields');
      return;
    }
    
    try {
      const imageUrl = await this.uploadImage();
      
      const blogData = {
        ...this.blogForm.value,
        featuredImage: imageUrl,
        updatedAt: new Date()
      };
      
      if (!this.isEditMode) {
        // Add new blog
        blogData.createdAt = new Date();
        blogData.author = {
          uid: this.user.uid,
          name: this.user.displayName || 'Admin',
          photoURL: this.user.photoURL || ''
        };
        blogData.views = 0;
        blogData.likes = 0;
        blogData.comments = 0;
        
        this.firestore.collection('posts').add(blogData)
          .then(() => {
            this.toastr.success('Blog post created successfully');
            this.closeModals();
          })
          .catch(error => {
            this.toastr.error('Error creating blog post');
            console.error('Error creating blog post:', error);
          });
      } else {
        // Update existing blog
        this.firestore.collection('posts').doc(this.selectedItem.id).update(blogData)
          .then(() => {
            this.toastr.success('Blog post updated successfully');
            this.closeModals();
          })
          .catch(error => {
            this.toastr.error('Error updating blog post');
            console.error('Error updating blog post:', error);
          });
      }
    } catch (error) {
      this.toastr.error('Error uploading image');
      console.error('Error uploading image:', error);
    }
  }
  
  savePracticeQuestion(): void {
    if (this.practiceForm.invalid) {
      this.toastr.error('Please fill all required fields');
      return;
    }
    
    const questionData = {
      ...this.practiceForm.value,
      updatedAt: new Date()
    };
    
    if (!this.isEditMode) {
      // Add new practice question
      questionData.createdAt = new Date();
      questionData.author = {
        uid: this.user.uid,
        name: this.user.displayName || 'Admin'
      };
      
      this.firestore.collection('questions').add(questionData)
        .then(() => {
          this.toastr.success('Practice question created successfully');
          this.closeModals();
        })
        .catch(error => {
          this.toastr.error('Error creating practice question');
          console.error('Error creating practice question:', error);
        });
    } else {
      // Update existing practice question
      this.firestore.collection('questions').doc(this.selectedItem.id).update(questionData)
        .then(() => {
          this.toastr.success('Practice question updated successfully');
          this.closeModals();
        })
        .catch(error => {
          this.toastr.error('Error updating practice question');
          console.error('Error updating practice question:', error);
        });
    }
  }
  
  deleteBlog(blog: any): void {
    if (confirm(`Are you sure you want to delete the blog post "${blog.title}"?`)) {
      this.firestore.collection('posts').doc(blog.id).delete()
        .then(() => {
          this.toastr.success('Blog post deleted successfully');
        })
        .catch(error => {
          this.toastr.error('Error deleting blog post');
          console.error('Error deleting blog post:', error);
        });
    }
  }
  
  deletePracticeQuestion(question: any): void {
    if (confirm(`Are you sure you want to delete the practice question "${question.title}"?`)) {
      this.firestore.collection('questions').doc(question.id).delete()
        .then(() => {
          this.toastr.success('Practice question deleted successfully');
        })
        .catch(error => {
          this.toastr.error('Error deleting practice question');
          console.error('Error deleting practice question:', error);
        });
    }
  }
}
