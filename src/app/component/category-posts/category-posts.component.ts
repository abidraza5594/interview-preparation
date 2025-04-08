import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { PostsService } from '../../services/posts.service';
import { CategoryService } from '../../services/category.service';
import { FormsModule } from '@angular/forms';
import { MatPaginatorModule } from '@angular/material/paginator';
import { GoogleAdComponent } from '../google-ad/google-ad.component';

interface PostData {
  title?: string;
  category?: {
    Category?: string;
    id?: string;
  };
  postType?: string;
  postImgPath?: string;
  featuredImage?: string;
  excerpt?: string;
  createdAt?: any;
  views?: number;
}

interface Post {
  id: string;
  data: PostData;
}

@Component({
  selector: 'app-category-posts',
  templateUrl: './category-posts.component.html',
  styleUrls: ['./category-posts.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatPaginatorModule,
    GoogleAdComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoryPostsComponent implements OnInit {
  categoryId: string | null = null;
  categoryName: string | null = null;
  posts: Post[] = [];
  loading: boolean = true;
  error: boolean = false;
  currentPage: number = 1;
  postsPerPage: number = 10;
  totalPosts: number = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postsService: PostsService,
    private categoryService: CategoryService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.categoryId = params.get('id');
      if (this.categoryId) {
        this.loadCategory();
        this.loadCategoryPosts();
      } else {
        this.error = true;
        this.loading = false;
      }
    });
  }

  loadCategory(): void {
    if (!this.categoryId) return;

    // First try to get category by ID
    this.categoryService.getCategoryById(this.categoryId).subscribe(
      category => {
        if (category) {
          // Found a specific category
          console.log('Category found:', category);
          
          const categoryData = category.data;
          // Handle string or object format
          this.categoryName = category.name || this.extractCategoryName(categoryData) || this.categoryId;
        } else {
          console.log('Category not found by ID, using ID as name:', this.categoryId);
          // If we don't find a category, it might be a direct category name
          this.categoryName = this.categoryId;
          
          // Look for matching categories in all categories
          this.categoryService.getCategories().subscribe(
            categories => {
              // Try to find a category that matches by name
              const matchingCategory = categories.find(cat => {
                const catName = this.extractCategoryName(cat.data);
                return catName && catName.toLowerCase() === this.categoryId?.toLowerCase();
              });
              
              if (matchingCategory) {
                console.log('Found matching category by name:', matchingCategory);
                this.categoryName = this.extractCategoryName(matchingCategory.data) || this.categoryId;
              }
            }
          );
        }
      },
      error => {
        console.error('Error loading category:', error);
        // Still set the name to the ID as fallback
        this.categoryName = this.categoryId;
      }
    );
  }
  
  // Helper to extract category name from data in different formats
  private extractCategoryName(data: any): string | null {
    if (!data) return null;
    
    if (data.category) {
      // Handle string or object format
      if (typeof data.category === 'string') {
        return data.category;
      } else if (typeof data.category === 'object') {
        return data.category.Category || null;
      }
    }
    
    return data.name || null;
  }

  loadCategoryPosts(): void {
    this.loading = true;
    this.error = false;

    this.postsService.loadLetestPosts().subscribe(
      posts => {
        console.log('All posts loaded:', posts);
        // Filter posts by category
        this.posts = posts.filter((post: any) => {
          if (!post || !post.data) return false;
          
          const postData = post.data as PostData;
          
          // Handle direct string category format from JSON data
          const postCategory = postData.category;
          const categoryValue = typeof postCategory === 'string' 
            ? postCategory 
            : (postCategory?.Category || null);
            
          console.log('Post category:', postCategory, 'Extracted value:', categoryValue, 'Looking for:', this.categoryId);
          
          // Match either by category ID or category name
          return (
            this.categoryId && (
              // Match by ID
              (post.id === this.categoryId) ||
              // Match by categoryValue directly
              (categoryValue === this.categoryId) ||
              // Case insensitive match
              (categoryValue && this.categoryId && 
               categoryValue.toLowerCase() === this.categoryId.toLowerCase()) ||
              // Match by postType
              (postData.postType === this.categoryId) ||
              (postData.postType && this.categoryId && 
               postData.postType.toLowerCase() === this.categoryId.toLowerCase())
            )
          );
        }) as Post[];
        
        console.log('Filtered posts:', this.posts);
        this.totalPosts = this.posts.length;
        this.loading = false;
      },
      error => {
        console.error('Error loading posts:', error);
        this.error = true;
        this.loading = false;
      }
    );
  }

  // Helper method to extract category name from different formats
  private getCategoryName(category: any): string | null {
    if (!category) return null;
    
    if (typeof category === 'string') {
      return category;
    }
    
    if (typeof category === 'object') {
      return category.Category || category.category || null;
    }
    
    return null;
  }

  onPageChange(event: any): void {
    this.currentPage = event.pageIndex + 1;
    this.postsPerPage = event.pageSize;
  }

  get paginatedPosts(): Post[] {
    const startIndex = (this.currentPage - 1) * this.postsPerPage;
    return this.posts.slice(startIndex, startIndex + this.postsPerPage);
  }

  createPermalink(title: string | undefined): string {
    if (!title) return '';
    // Convert to lowercase, replace spaces with hyphens, remove special characters
    return title
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '-');
  }
} 