import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { AuthService } from '../../services/auth.service';
import { CategoryService } from '../../services/category.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { finalize } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { QuillModule } from 'ngx-quill';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-create-post',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    QuillModule
  ],
  templateUrl: './create-post.component.html',
  styleUrls: ['./create-post.component.css']
})
export class CreatePostComponent implements OnInit {
  postForm: FormGroup;
  categories: any[] = [];
  isSubmitting = false;
  uploadPercent: Observable<number | undefined> | null = null;
  downloadURL: Observable<string> | null = null;
  imagePreview: string | null = null;
  
  // Quill editor configuration
  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ 'header': 1 }, { 'header': 2 }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'direction': 'rtl' }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'font': [] }],
      [{ 'align': [] }],
      ['clean'],
      ['link', 'image', 'video']
    ]
  };

  constructor(
    private fb: FormBuilder,
    private firestore: AngularFirestore,
    private storage: AngularFireStorage,
    private authService: AuthService,
    private categoryService: CategoryService,
    private router: Router,
    private toastr: ToastrService
  ) {
    this.postForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5)]],
      category: ['', Validators.required],
      content: ['', [Validators.required, Validators.minLength(50)]],
      featuredImage: [''],
      excerpt: ['', [Validators.required, Validators.maxLength(200)]],
      tags: [''],
      isPublished: [true],
      isFeatured: [false],
      postType: ['post'] // Default to 'post', other options: 'frontend', 'backend', 'animated'
    });
  }

  ngOnInit(): void {
    // Load categories using CategoryService
    this.categoryService.getCategories().subscribe(
      (categories) => {
        this.categories = categories;
        console.log('Loaded categories:', this.categories);
        
        // If no categories exist, create a test category
        if (categories.length === 0) {
          this.createTestCategories();
        }
      },
      (error) => {
        console.error('Error loading categories:', error);
        this.toastr.error('Error loading categories');
      }
    );
  }

  // Create test categories if none exist
  createTestCategories(): void {
    const testCategories = [
      { name: 'Frontend Development', description: 'Topics related to frontend development' },
      { name: 'Backend Development', description: 'Topics related to backend development' },
      { name: 'DevOps', description: 'Topics related to DevOps and deployment' },
      { name: 'Data Structures', description: 'Topics related to data structures and algorithms' }
    ];
    
    testCategories.forEach(category => {
      this.categoryService.createCategory(category)
        .then(id => {
          console.log(`Created test category: ${category.name} with ID: ${id}`);
          this.toastr.success(`Created category: ${category.name}`);
        })
        .catch(error => {
          console.error(`Error creating category ${category.name}:`, error);
        });
    });
  }

  // Handle image upload
  uploadImage(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Preview the image
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string;
      };
      reader.readAsDataURL(file);

      // Upload to Firebase Storage
      const filePath = `post-images/${new Date().getTime()}_${file.name}`;
      const fileRef = this.storage.ref(filePath);
      const task = this.storage.upload(filePath, file);

      // Get upload progress
      this.uploadPercent = task.percentageChanges();

      // Get download URL when upload completes
      task.snapshotChanges().pipe(
        finalize(() => {
          this.downloadURL = fileRef.getDownloadURL();
          this.downloadURL.subscribe(url => {
            this.postForm.patchValue({ featuredImage: url });
          });
        })
      ).subscribe();
    }
  }

  // Submit the form
  onSubmit(): void {
    if (this.postForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.postForm.controls).forEach(key => {
        const control = this.postForm.get(key);
        control?.markAsTouched();
      });
      this.toastr.error('Please fix the errors in the form');
      return;
    }

    this.isSubmitting = true;
    
    // Use the observable properly with subscription
    this.authService.getCurrentUser().pipe(
      take(1)
    ).subscribe(user => {
      if (!user) {
        this.toastr.error('You must be logged in to create a post');
        this.isSubmitting = false;
        return;
      }

      // Prepare tags array
      const tagsString = this.postForm.get('tags')?.value || '';
      const tagsArray = tagsString.split(',')
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.length > 0);

      // Get the selected category
      const categoryId = this.postForm.get('category')?.value;
      let categoryData = {
        Category: 'Uncategorized',
        CategoryId: categoryId || 'default'
      };
      
      // Find the category object from the categories array
      if (categoryId) {
        const selectedCategory = this.categories.find(cat => cat.id === categoryId);
        if (selectedCategory) {
          categoryData = {
            Category: selectedCategory.name || 
                     (selectedCategory.data && selectedCategory.data.category && selectedCategory.data.category.Category) || 
                     'Uncategorized',
            CategoryId: categoryId
          };
        }
      }

      console.log('Selected category:', categoryData);

      // Generate a permalink from the title
      const title = this.postForm.get('title')?.value;
      const permalink = title
        ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')
        : '';

      // Create post object
      const post = {
        title: this.postForm.get('title')?.value || '',
        category: categoryData,
        content: this.postForm.get('content')?.value || '',
        featuredImage: this.postForm.get('featuredImage')?.value || '',
        excerpt: this.postForm.get('excerpt')?.value || '',
        isPublished: this.postForm.get('isPublished')?.value || false,
        isFeatured: this.postForm.get('isFeatured')?.value || false,
        postType: this.postForm.get('postType')?.value || 'post',
        tags: tagsArray,
        permalink: permalink,
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        authorImage: user.photoURL || '',
        createdBy: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
        views: 0,
        likes: 0,
        comments: 0
      };

      console.log('Saving post:', post);

      // Save the post directly without section management
      this.saveNewPost(post);
    },
    error => {
      console.error('Error getting user:', error);
      this.toastr.error('Error getting user data');
      this.isSubmitting = false;
    });
  }

  // Save the new post to Firestore
  private saveNewPost(post: any): void {
    this.firestore.collection('posts').add(post)
      .then(docRef => {
        this.toastr.success('Post created successfully!');
        this.router.navigate(['/dashboard']);
      })
      .catch(error => {
        console.error('Error adding post: ', error);
        this.toastr.error('Error creating post. Please try again.');
      })
      .finally(() => {
        this.isSubmitting = false;
      });
  }

  // Cancel and go back
  cancel(): void {
    this.router.navigate(['/dashboard']);
  }
}
