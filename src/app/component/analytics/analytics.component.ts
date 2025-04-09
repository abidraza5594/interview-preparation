import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { ToastrService } from 'ngx-toastr';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

interface AnalyticsData {
  totalUsers: number;
  newUsers: number;
  totalPosts: number;
  newPosts: number;
  activeUsers: number;
  avgPostsPerUser: number;
  categoryData: { name: string; count: number }[];
  userActivity: { date: Date; newUsers: number; newPosts: number }[];
  topContributors: any[];
}

interface Post {
  id: string;
  title: string;
  category: any;
  createdAt: any;
  views: number;
  likes: number;
  comments: number;
  createdBy?: string;
}

interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: string;
  createdAt: any;
  lastLogin?: any;
  photoURL?: string;
  postCount?: number;
}

interface CategoryData {
  name: string;
  count: number;
  percentage: number;
}

@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalyticsComponent implements OnInit {
  analyticsData$: Observable<AnalyticsData>;
  timeRange: 'day' | 'week' | 'month' | 'year' | 'all' = 'month';
  
  isAdmin: boolean = false;
  loading: boolean = true;
  
  // Post-specific analytics
  posts: Post[] = [];
  filteredPosts: Post[] = [];
  searchTerm: string = '';
  sortField: 'title' | 'views' | 'likes' | 'comments' | 'createdAt' = 'views';
  sortDirection: 'asc' | 'desc' = 'desc';
  
  // Detailed post view
  selectedPost: Post | null = null;
  showDetailedView: boolean = false;
  postComments: any[] = [];
  postViewsHistory: any[] = [];

  constructor(
    private firestore: AngularFirestore,
    private auth: AngularFireAuth,
    private authService: AuthService,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {
    this.analyticsData$ = of(null).pipe(
      switchMap(() => this.getAnalyticsData())
    );
  }

  ngOnInit(): void {
    this.auth.user.subscribe(user => {
      if (user) {
        this.checkAdminStatus(user.uid);
      } else {
        this.loading = false;
        this.toastr.error('You must be logged in to access analytics');
        this.cdr.markForCheck();
      }
    });
  }
  
  checkAdminStatus(uid: string): void {
    // Use the improved auth service
    this.authService.isAdmin().subscribe(isAdmin => {
      this.isAdmin = isAdmin;
      console.log('Admin status check:', { uid, isAdmin });
      
      if (!this.isAdmin) {
        this.toastr.error('You do not have permission to access analytics');
      } else {
        this.toastr.success('Admin access granted');
        // Load post-specific analytics if user is admin
        this.loadPostAnalytics();
      }
      
      this.loading = false;
      this.cdr.markForCheck();
    },
    // Handle errors in the subscription
    (error) => {
      console.error('Error checking admin status:', error);
      this.loading = false;
      this.toastr.error('Error checking admin permissions');
      this.cdr.markForCheck();
    });
  }
  
  loadPostAnalytics(): void {
    this.firestore.collection('posts').snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as any;
        const id = a.payload.doc.id;
        return {
          id,
          title: data.title || 'Untitled',
          category: data.category || 'Uncategorized',
          createdAt: data.createdAt,
          views: data.views || 0,
          likes: data.likes || 0,
          comments: data.comments || 0,
          createdBy: data.createdBy
        } as Post;
      }))
    ).subscribe(posts => {
      this.posts = posts;
      this.applySearch();
      this.sortPosts();
    });
  }
  
  applySearch(): void {
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      this.filteredPosts = [...this.posts];
    } else {
      const term = this.searchTerm.toLowerCase().trim();
      this.filteredPosts = this.posts.filter(post => 
        post.title.toLowerCase().includes(term) || 
        post.category.toLowerCase().includes(term)
      );
    }
  }
  
  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
    this.applySearch();
    this.sortPosts();
  }
  
  sortPosts(): void {
    this.filteredPosts.sort((a, b) => {
      let comparison = 0;
      
      switch (this.sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'views':
          comparison = a.views - b.views;
          break;
        case 'likes':
          comparison = a.likes - b.likes;
          break;
        case 'comments':
          comparison = a.comments - b.comments;
          break;
        case 'createdAt':
          const dateA = this.getDateFromTimestamp(a.createdAt) || new Date(0);
          const dateB = this.getDateFromTimestamp(b.createdAt) || new Date(0);
          comparison = dateA.getTime() - dateB.getTime();
          break;
      }
      
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }
  
  updateSort(field: 'title' | 'views' | 'likes' | 'comments' | 'createdAt'): void {
    if (this.sortField === field) {
      // Toggle direction if same field
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Set new field and default to descending
      this.sortField = field;
      this.sortDirection = 'desc';
    }
    
    this.sortPosts();
  }
  
  getSortIcon(field: 'title' | 'views' | 'likes' | 'comments' | 'createdAt'): string {
    if (this.sortField !== field) {
      return 'fa-sort';
    }
    
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }
  
  getMaxValue(field: 'views' | 'likes' | 'comments'): number {
    if (this.posts.length === 0) {
      return 0;
    }
    
    // Calculate max value from all posts, not just filtered ones
    // This ensures consistent progress bar scaling
    return Math.max(...this.posts.map(post => post[field] || 0));
  }
  
  getMaxDailyViews(): number {
    if (this.postViewsHistory.length === 0) {
      return 0;
    }
    
    return Math.max(...this.postViewsHistory.map(day => day.views || 0));
  }
  
  formatDate(date: Date): string {
    if (!date) return 'N/A';
    
    // Format based on time range
    if (this.timeRange === 'day') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (this.timeRange === 'week') {
      return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  
  exportToCSV(): void {
    if (this.filteredPosts.length === 0) {
      this.toastr.warning('No data to export');
      return;
    }
    
    // Create CSV header
    const headers = ['Title', 'Category', 'Created Date', 'Views', 'Likes', 'Comments'];
    
    // Create CSV rows
    const rows = this.filteredPosts.map(post => [
      `"${post.title.replace(/"/g, '""')}"`, // Escape quotes in title
      post.category,
      this.getDateFromTimestamp(post.createdAt)?.toISOString() || '',
      post.views,
      post.likes,
      post.comments
    ]);
    
    // Combine header and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Set link properties
    link.setAttribute('href', url);
    link.setAttribute('download', `post-analytics-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    
    // Add to document, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.toastr.success('Analytics data exported successfully');
  }
  
  updateTimeRange(range: 'day' | 'week' | 'month' | 'year' | 'all'): void {
    this.timeRange = range;
    this.analyticsData$ = this.getAnalyticsData();
  }
  
  getAnalyticsData(): Observable<AnalyticsData> {
    // Get date threshold based on selected time range
    const dateThreshold = this.getDateThreshold();
    
    // Get posts
    const posts$ = this.firestore.collection('posts').snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as any;
        const id = a.payload.doc.id;
        return { 
          id, 
          title: data.title || 'Untitled',
          category: data.category || 'Uncategorized',
          createdAt: data.createdAt,
          views: data.views || 0,
          likes: data.likes || 0,
          comments: data.comments || 0,
          createdBy: data.createdBy
        } as Post;
      })),
      map(posts => posts.filter(post => {
        if (this.timeRange === 'all') return true;
        const postDate = this.getDateFromTimestamp(post.createdAt);
        return postDate && postDate >= dateThreshold;
      }))
    );
    
    // Get users
    const users$ = this.firestore.collection<User>('users').snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as Omit<User, 'uid'>;
        const uid = a.payload.doc.id;
        
        // Process the data to ensure timestamps are properly handled
        return { 
          uid, 
          ...data,
          // Ensure createdAt is properly captured, default to now if missing
          createdAt: data.createdAt || new Date(),
          // Ensure lastLogin is properly captured
          lastLogin: data.lastLogin || null
        };
      })),
      map(users => users.filter(user => {
        if (this.timeRange === 'all') return true;
        const userDate = this.getDateFromTimestamp(user.createdAt);
        return userDate && userDate >= dateThreshold;
      }))
    );
    
    return combineLatest([posts$, users$]).pipe(
      map(([posts, users]) => {
        // Calculate totals
        const totalPosts = posts.length;
        const totalUsers = users.length;
        const totalViews = posts.reduce((sum, post) => sum + (post.views || 0), 0);
        const totalLikes = posts.reduce((sum, post) => sum + (post.likes || 0), 0);
        const totalComments = posts.reduce((sum, post) => sum + (post.comments || 0), 0);
        
        // Calculate new posts and users in this period
        const newPosts = posts.length;
        const newUsers = users.length;
        
        // Calculate active users (users who have posts)
        const postsByUser = posts.reduce((acc, post) => {
          // Use the createdBy field if available, otherwise try to extract from id
          const userId = post.createdBy || post.id?.split('_')[0] || '';
          if (userId) {
            acc[userId] = (acc[userId] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);
        
        // Count users who have at least one post
        const activeUsers = Object.keys(postsByUser).length || 0;
        
        // If we have posts but no active users detected, assume at least one active user
        const effectiveActiveUsers = (totalPosts > 0 && activeUsers === 0) ? 1 : activeUsers;
        
        const avgPostsPerUser = effectiveActiveUsers > 0 ? totalPosts / effectiveActiveUsers : 0;
        
        // Calculate category distribution
        const categoryCounts: Record<string, number> = {};
        posts.forEach(post => {
          if (post.category) {
            const categoryName = this.getCategoryName(post.category);
            categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1;
          }
        });
        
        const categoryData: CategoryData[] = Object.keys(categoryCounts).map(name => ({
          name,
          count: categoryCounts[name],
          percentage: (categoryCounts[name] / totalPosts) * 100
        })).sort((a, b) => b.count - a.count);
        
        // Calculate user activity over time
        const userActivity: { date: Date; newUsers: number; newPosts: number }[] = [];
        
        // Group by date
        const usersByDate: Record<string, number> = {};
        const postsByDate: Record<string, number> = {};
        
        users.forEach(user => {
          const date = user.createdAt.toDate();
          const dateStr = date.toISOString().split('T')[0];
          usersByDate[dateStr] = (usersByDate[dateStr] || 0) + 1;
        });
        
        posts.forEach(post => {
          const date = post.createdAt.toDate();
          const dateStr = date.toISOString().split('T')[0];
          postsByDate[dateStr] = (postsByDate[dateStr] || 0) + 1;
        });
        
        // Combine data
        const allDates = [...new Set([...Object.keys(usersByDate), ...Object.keys(postsByDate)])];
        allDates.sort();
        
        allDates.forEach(dateStr => {
          userActivity.push({
            date: new Date(dateStr),
            newUsers: usersByDate[dateStr] || 0,
            newPosts: postsByDate[dateStr] || 0
          });
        });
        
        // Get top contributors
        const topContributors = users
          .map(user => ({
            ...user,
            postCount: postsByUser[user.uid] || 0
          }))
          .sort((a, b) => b.postCount - a.postCount)
          .slice(0, 5);
        
        return {
          totalPosts,
          totalUsers,
          totalViews,
          totalLikes,
          totalComments,
          newPosts,
          newUsers,
          activeUsers: effectiveActiveUsers,
          avgPostsPerUser,
          categoryData,
          userActivity,
          topContributors
        };
      })
    );
  }
  
  getDateThreshold(): Date {
    const now = new Date();
    const threshold = new Date(now);
    
    switch (this.timeRange) {
      case 'day':
        threshold.setDate(now.getDate() - 1);
        break;
      case 'week':
        threshold.setDate(now.getDate() - 7);
        break;
      case 'month':
        threshold.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        threshold.setFullYear(now.getFullYear() - 1);
        break;
      default:
        // 'all' - no threshold
        threshold.setFullYear(1970);
    }
    
    return threshold;
  }

  viewPostDetails(post: Post): void {
    this.selectedPost = post;
    this.showDetailedView = true;
    this.loading = true;
    
    // Load post comments - modified to avoid requiring a composite index
    this.firestore.collection('comments', ref => 
      ref.where('postId', '==', post.id)
    ).snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as any;
        const id = a.payload.doc.id;
        return { id, ...data };
      })),
      // Sort in memory instead of in the query
      map(comments => comments.sort((a, b) => {
        const dateA = this.getDateFromTimestamp(a.createdAt) || new Date(0);
        const dateB = this.getDateFromTimestamp(b.createdAt) || new Date(0);
        return dateB.getTime() - dateA.getTime(); // Descending order
      }))
    ).subscribe(comments => {
      this.postComments = comments;
      this.loading = false;
    });
    
    // Load post views history (simulated data for now)
    // In a real app, you would fetch this from a dedicated analytics collection
    const now = new Date();
    const viewsHistory = [];
    
    // Generate simulated data for the last 30 days
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Create some random but somewhat realistic data
      // Base it on the current view count to make it look plausible
      const baseViews = Math.max(1, Math.floor(post.views / 40));
      const dailyViews = Math.floor(baseViews * (0.5 + Math.random()));
      
      viewsHistory.push({
        date,
        views: dailyViews
      });
    }
    
    this.postViewsHistory = viewsHistory;
  }
  
  closeDetailedView(): void {
    this.showDetailedView = false;
    this.selectedPost = null;
    this.postComments = [];
    this.postViewsHistory = [];
  }

  // Helper method to safely convert Firestore timestamp to Date
  getDateFromTimestamp(timestamp: any): Date | null {
    if (!timestamp) return null;
    
    try {
      // Handle Firestore Timestamp objects
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
      }
      
      // Handle ISO date strings
      if (typeof timestamp === 'string') {
        return new Date(timestamp);
      }
      
      // Handle numeric timestamps
      if (typeof timestamp === 'number') {
        return new Date(timestamp);
      }
      
      // Handle Date objects
      if (timestamp instanceof Date) {
        return timestamp;
      }
    } catch (error) {
      console.error('Error parsing timestamp:', error);
    }
    
    return null;
  }

  /**
   * Safely extract category name from various types of category data
   */
  getCategoryName(category: any): string {
    if (!category) return 'Uncategorized';
    
    // Handle string categories
    if (typeof category === 'string') {
      return category;
    }
    
    // Handle object categories
    if (typeof category === 'object') {
      if (category.name) {
        return category.name;
      } else if (category.Category) {
        return category.Category;
      } else if (category.categoryName) {
        return category.categoryName;
      } else if (category.id) {
        return category.id;
      } else {
        try {
          const str = JSON.stringify(category);
          return str !== '[object Object]' ? str : 'Uncategorized';
        } catch (e) {
          return 'Uncategorized';
        }
      }
    }
    
    // Fallback
    return String(category);
  }
} 