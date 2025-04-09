import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { ToastrService } from 'ngx-toastr';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

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
        // Update user's lastLogin time on app initialization
        this.updateUserLastLogin(user.uid);
        this.checkAdminStatus(user.uid);
      } else {
        this.isAdmin = false;
        this.loading = false;
        this.toastr.error('You must be logged in to access analytics');
        this.cdr.markForCheck();
      }
    });
  }
  
  /**
   * Update user's lastLogin timestamp in Firestore
   */
  updateUserLastLogin(uid: string): void {
    const now = new Date();
    this.firestore.collection('users').doc(uid).update({
      lastLogin: now
    }).catch(error => {
      console.error('Error updating lastLogin timestamp:', error);
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
        // Load post-specific analytics only if user is admin
        this.loadPostAnalytics();
      }
      
      this.loading = false;
      this.cdr.markForCheck();
    },
    // Handle errors in the subscription
    (error) => {
      console.error('Error checking admin status:', error);
      this.isAdmin = false;
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
    
    try {
      // Verify it's a valid date
      if (isNaN(date.getTime())) {
        console.warn('Invalid date encountered:', date);
        return 'Invalid Date';
      }
      
      // Format based on time range
      if (this.timeRange === 'day') {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (this.timeRange === 'week') {
        return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      } else if (this.timeRange === 'month' || this.timeRange === 'year') {
        // For month view, show full month name
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        return monthNames[date.getMonth()] + ' ' + date.getFullYear();
      } else {
        // All time view - just show the year
        return date.getFullYear().toString();
      }
    } catch (error) {
      console.error('Error formatting date:', error, date);
      return 'Date Error';
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
    console.log(this.analyticsData$.subscribe((data: any) => {
      console.log(data, 'dataaaaaa');
    }));
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
      map(posts => {
        // Filter posts and ensure valid dates
        try {
          return posts.filter(post => {
            if (this.timeRange === 'all') return true;
            
            const postDate = this.getDateFromTimestamp(post.createdAt);
            // Skip invalid dates or null dates
            if (!postDate) return false;
            
            try {
              return postDate >= dateThreshold;
            } catch (error) {
              console.error('Error comparing dates:', error, { postDate, dateThreshold });
              return false; // Skip this post if date comparison fails
            }
          });
        } catch (error) {
          console.error('Error filtering posts by date:', error);
          return posts; // Return all posts if filtering fails
        }
      })
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
          // Fix: Better handling of lastLogin field
          lastLogin: data.lastLogin || null
        };
      })),
      map(users => {
        // Filter users and ensure valid dates
        try {
          return users.filter(user => {
            if (this.timeRange === 'all') return true;
            
            const userDate = this.getDateFromTimestamp(user.createdAt);
            // Skip invalid dates or null dates
            if (!userDate) return false;
            
            try {
              return userDate >= dateThreshold;
            } catch (error) {
              console.error('Error comparing user dates:', error, { userDate, dateThreshold });
              return false; // Skip this user if date comparison fails
            }
          });
        } catch (error) {
          console.error('Error filtering users by date:', error);
          return users; // Return all users if filtering fails
        }
      })
    );
    
    // Combine the data from posts and users
    return combineLatest([posts$, users$]).pipe(
      map(([posts, users]) => {
        // Keep the original arrays for reference
        this.posts = [...posts];
        this.filteredPosts = [...posts];
        
        // Apply search filter if search term is set
        if (this.searchTerm) {
          this.applySearch();
        }
        
        // Initialize variables for calculating analytics
        let newPosts = 0;
        let totalViews = 0;
        let totalLikes = 0;
        let totalComments = 0;
        
        // Count new posts created in this time range
        try {
          const now = new Date();
          newPosts = posts.reduce((count, post) => {
            const postDate = this.getDateFromTimestamp(post.createdAt);
            if (!postDate) return count;
            
            // Check if post was created in timeRange
            try {
              // Add safety check for postDate
              if (isNaN(postDate.getTime())) {
                console.warn('Invalid post date found:', postDate);
                return count;
              }
              
              return count + 1;
            } catch (error) {
              console.error('Error counting new post:', error, post);
              return count;
            }
          }, 0);
        } catch (error) {
          console.error('Error calculating new posts:', error);
          // Set a default value if calculation fails
          newPosts = posts.length;
        }
        
        // Calculate totals from posts
        try {
          for (const post of posts) {
            totalViews += post.views || 0;
            totalLikes += post.likes || 0;
            totalComments += post.comments || 0;
          }
        } catch (error) {
          console.error('Error calculating post totals:', error);
        }
        
        // Count new users registered in this time range
        let newUsers = 0;
        try {
          newUsers = users.reduce((count, user) => {
            const userDate = this.getDateFromTimestamp(user.createdAt);
            if (!userDate) return count;
            
            try {
              // Add safety check for userDate
              if (isNaN(userDate.getTime())) {
                console.warn('Invalid user date found:', userDate);
                return count;
              }
              
              return count + 1;
            } catch (error) {
              console.error('Error counting new user:', error, user);
              return count;
            }
          }, 0);
        } catch (error) {
          console.error('Error calculating new users:', error);
          // Set a default value if calculation fails
          newUsers = users.length;
        }
        
        // Calculate category distribution
        const categoryData: CategoryData[] = [];
        try {
          // Count posts by category
          const categoryMap = new Map<string, number>();
          for (const post of posts) {
            const categoryName = this.getCategoryName(post.category);
            categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + 1);
          }
          
          // Calculate percentages and format data for the chart
          const totalPosts = posts.length;
          if (totalPosts > 0) {
            // Avoid division by zero
            categoryMap.forEach((count, name) => {
              categoryData.push({
                name,
                count,
                percentage: Math.round((count / totalPosts) * 100)
              });
            });
          }
          
          // Sort by count, descending
          categoryData.sort((a, b) => b.count - a.count);
        } catch (error) {
          console.error('Error calculating category distribution:', error);
        }
        
        // Calculate user activity over time
        const userActivity: { date: Date; newUsers: number; newPosts: number }[] = [];
        try {
          // Create date ranges based on timeRange
          const dateRanges: Date[] = [];
          const currentDate = new Date();
          
          // Create an array of dates based on the selected time range
          if (this.timeRange === 'day') {
            // Last 24 hours by hour
            for (let i = 23; i >= 0; i--) {
              const date = new Date(currentDate);
              date.setHours(currentDate.getHours() - i);
              date.setMinutes(0, 0, 0);
              dateRanges.push(date);
            }
          } else if (this.timeRange === 'week') {
            // Last 7 days
            for (let i = 6; i >= 0; i--) {
              const date = new Date(currentDate);
              date.setDate(currentDate.getDate() - i);
              date.setHours(0, 0, 0, 0);
              dateRanges.push(date);
            }
          } else if (this.timeRange === 'month') {
            // Show all 12 months of the current year (Jan-Dec)
            const currentYear = currentDate.getFullYear();
            dateRanges.length = 0; // Clear existing ranges
            
            // Create dates for all 12 months
            for (let month = 0; month < 12; month++) {
              const date = new Date(currentYear, month, 1);
              date.setHours(0, 0, 0, 0);
              dateRanges.push(date);
            }
            
            console.log('Generated all months for month view:', dateRanges.map(d => d.toLocaleString()));
          } else if (this.timeRange === 'year') {
            // Generate all 12 months of the year
            const currentYear = currentDate.getFullYear();
            dateRanges.length = 0; // Clear existing ranges
            
            // Create dates for all 12 months of current year
            for (let month = 0; month < 12; month++) {
              const date = new Date(currentYear, month, 1);
              date.setHours(0, 0, 0, 0);
              dateRanges.push(date);
            }
            
            console.log('Generated all months for year view:', dateRanges.map(d => d.toLocaleString()));
          } else {
            // All time - use yearly data for the last 5 years
            for (let i = 4; i >= 0; i--) {
              const date = new Date(currentDate);
              date.setFullYear(currentDate.getFullYear() - i);
              date.setMonth(0, 1);
              date.setHours(0, 0, 0, 0);
              dateRanges.push(date);
            }
          }
          
          // Filter users and posts with valid dates for processing
          const validUsers = users.filter(user => {
            const d = this.getDateFromTimestamp(user.createdAt);
            return d && !isNaN(d.getTime());
          });
          
          const validPosts = posts.filter(post => {
            const d = this.getDateFromTimestamp(post.createdAt);
            return d && !isNaN(d.getTime());
          });
          
          console.log('Processing user activity for selected timeRange:', this.timeRange);
          console.log('Date ranges generated:', dateRanges.map(d => this.formatDate(d)));
          console.log('Valid users count:', validUsers.length);
          console.log('Valid posts count:', validPosts.length);
          
          // Process each date range
          for (let i = 0; i < dateRanges.length; i++) {
            const startDate = new Date(dateRanges[i]);
            let endDate: Date;
            
            if (this.timeRange === 'day') {
              // For day view, each slot is 1 hour
              endDate = new Date(startDate);
              endDate.setHours(startDate.getHours() + 1);
            } else if (this.timeRange === 'week') {
              // For week view, each slot is 1 day
              endDate = new Date(startDate);
              endDate.setDate(startDate.getDate() + 1);
            } else if (this.timeRange === 'month' || this.timeRange === 'year') {
              // For month/year view, each slot is 1 month
              endDate = new Date(startDate);
              endDate.setMonth(startDate.getMonth() + 1);
            } else {
              // For all time view, each slot is 1 year
              endDate = new Date(startDate);
              endDate.setFullYear(startDate.getFullYear() + 1);
            }
            
            // Calculate month-specific counts for users
            let usersInRange = 0;
            validUsers.forEach(user => {
              const userDate = this.getDateFromTimestamp(user.createdAt);
              if (!userDate || isNaN(userDate.getTime())) return;
              
              if (this.timeRange === 'day') {
                // For day, check hour
                if (userDate.getHours() === startDate.getHours() &&
                    userDate.getDate() === startDate.getDate() &&
                    userDate.getMonth() === startDate.getMonth() &&
                    userDate.getFullYear() === startDate.getFullYear()) {
                  usersInRange++;
                }
              } else if (this.timeRange === 'week') {
                // For week, check day
                if (userDate.getDate() === startDate.getDate() &&
                    userDate.getMonth() === startDate.getMonth() &&
                    userDate.getFullYear() === startDate.getFullYear()) {
                  usersInRange++;
                }
              } else if (this.timeRange === 'month' || this.timeRange === 'year') {
                // For month/year, check month
                if (userDate.getMonth() === startDate.getMonth() && 
                    userDate.getFullYear() === startDate.getFullYear()) {
                  usersInRange++;
                }
              } else {
                // For all, check year
                if (userDate.getFullYear() === startDate.getFullYear()) {
                  usersInRange++;
                }
              }
            });
            
            // Calculate month-specific counts for posts
            let postsInRange = 0;
            validPosts.forEach(post => {
              const postDate = this.getDateFromTimestamp(post.createdAt);
              if (!postDate || isNaN(postDate.getTime())) return;
              
              if (this.timeRange === 'day') {
                // For day, check hour
                if (postDate.getHours() === startDate.getHours() &&
                    postDate.getDate() === startDate.getDate() &&
                    postDate.getMonth() === startDate.getMonth() &&
                    postDate.getFullYear() === startDate.getFullYear()) {
                  postsInRange++;
                }
              } else if (this.timeRange === 'week') {
                // For week, check day
                if (postDate.getDate() === startDate.getDate() &&
                    postDate.getMonth() === startDate.getMonth() &&
                    postDate.getFullYear() === startDate.getFullYear()) {
                  postsInRange++;
                }
              } else if (this.timeRange === 'month' || this.timeRange === 'year') {
                // For month/year, check month and year
                if (postDate.getMonth() === startDate.getMonth() && 
                    postDate.getFullYear() === startDate.getFullYear()) {
                  postsInRange++;
                }
              } else {
                // For all, check year
                if (postDate.getFullYear() === startDate.getFullYear()) {
                  postsInRange++;
                }
              }
            });
            
            // Calculate the month name for logging
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
            const monthName = monthNames[startDate.getMonth()];
            
            console.log(`Activity for ${monthName} ${startDate.getFullYear()}: ${usersInRange} users, ${postsInRange} posts`);
            
            userActivity.push({
              date: startDate,
              newUsers: usersInRange,
              newPosts: postsInRange
            });
          }
        } catch (error) {
          console.error('Error calculating user activity over time:', error);
        }
        
        // For top contributors, add post count to each user
        let topContributors: any[] = [];
        try {
          // Reset any existing calculations
          const userPostCounts = new Map<string, number>();
          
          // Count posts per user more reliably
          for (const post of posts) {
            if (post.createdBy) {
              userPostCounts.set(post.createdBy, (userPostCounts.get(post.createdBy) || 0) + 1);
            }
          }
          
          console.log(`Found ${userPostCounts.size} users with posts`);
          
          // Get all users from Firestore to ensure we have complete user data
          const userIdsWithPosts = Array.from(userPostCounts.keys());
          
          if (userIdsWithPosts.length === 0) {
            console.log('No users with posts found');
            topContributors = [];
          } else {
            // Filter the already fetched users
            const usersWithPosts = users.filter(user => userPostCounts.has(user.uid));
            
            console.log(`Matched ${usersWithPosts.length} users with posts`);
            
            // Create contributor list with post counts
            topContributors = usersWithPosts
              .map(user => ({
                ...user,
                postCount: userPostCounts.get(user.uid) || 0,
                createdAt: this.getDateFromTimestamp(user.createdAt),
                lastLogin: this.getDateFromTimestamp(user.lastLogin)
              }))
              .sort((a, b) => (b.postCount || 0) - (a.postCount || 0))
              .slice(0, 5); // Top 5 contributors
            
            console.log('Top contributors:', topContributors);
          }
        } catch (error) {
          console.error('Error calculating top contributors:', error);
          topContributors = [];
        }
        
        // Calculate average posts per user
        const avgPostsPerUser = users.length > 0 ? posts.length / users.length : 0;
        
        // Sort posts for the table view
        this.sortPosts();
        
        return {
          totalUsers: users.length,
          newUsers,
          totalPosts: posts.length,
          newPosts,
          activeUsers: Math.min(users.length, Math.round(users.length * 0.7)), // Estimate active users
          avgPostsPerUser,
          categoryData,
          userActivity,
          topContributors
        };
      }),
      tap({
        error: error => {
          console.error('Error in analytics data pipeline:', error);
          this.toastr.error('Error loading analytics data');
        }
      })
    );
  }
  
  getDateThreshold(): Date {
    try {
      const now = new Date();
      // Validate that now is a proper date
      if (isNaN(now.getTime())) {
        console.error('Invalid current date');
        // Fallback to current time using constructor
        return new Date();
      }
      
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
          // 'all' - default to a far past date
          threshold.setFullYear(1970);
      }
      
      // Validate that threshold is a proper date
      if (isNaN(threshold.getTime())) {
        console.error('Invalid threshold date after calculation');
        // Fallback to a year ago
        const fallbackDate = new Date();
        fallbackDate.setFullYear(fallbackDate.getFullYear() - 1);
        return fallbackDate;
      }
      
      return threshold;
    } catch (error) {
      console.error('Error in getDateThreshold:', error);
      // Return a reasonable default (1 year ago)
      const fallbackDate = new Date();
      fallbackDate.setFullYear(fallbackDate.getFullYear() - 1);
      return fallbackDate;
    }
  }

  viewPostDetails(post: Post): void {
    // Only proceed if user is admin
    if (!this.isAdmin) {
      this.toastr.error('You do not have permission to view analytics details');
      return;
    }
    
    this.selectedPost = post;
    this.showDetailedView = true;
    this.loading = true;
    this.cdr.markForCheck();
    
    // Load post comments from all collections (main comments and post comments)
    const commentQueries = [
      // Check the 'comments' collection
      this.firestore.collection('comments', ref => 
        ref.where('postId', '==', post.id)
      ).snapshotChanges(),
      
      // Also check the post-specific comments collection
      this.firestore.collection(`posts/${post.id}/comments`).snapshotChanges()
    ];
    
    // Combine the results from both queries
    combineLatest(commentQueries).pipe(
      map(([generalComments, postComments]) => {
        // Process general comments (from 'comments' collection)
        const comments1 = generalComments.map(a => {
          const data = a.payload.doc.data() as any;
          const id = a.payload.doc.id;
          return { id, ...data };
        });
        
        // Process post-specific comments
        const comments2 = postComments.map(a => {
          const data = a.payload.doc.data() as any;
          const id = a.payload.doc.id;
          return { id, ...data };
        });
        
        // Combine and sort all comments
        return [...comments1, ...comments2].sort((a, b) => {
          const dateA = this.getDateFromTimestamp(a.createdAt) || new Date(0);
          const dateB = this.getDateFromTimestamp(b.createdAt) || new Date(0);
          return dateB.getTime() - dateA.getTime(); // Descending order
        });
      })
    ).subscribe(
      comments => {
        this.postComments = comments;
        console.log('Loaded comments:', comments);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error => {
        console.error('Error loading comments:', error);
        this.loading = false;
        this.toastr.error('Error loading comments');
        this.cdr.markForCheck();
      }
    );
    
    // No need for postViewsHistory anymore since we removed that section
    this.cdr.markForCheck();
  }
  
  closeDetailedView(): void {
    this.showDetailedView = false;
    this.selectedPost = null;
    this.postComments = [];
    this.postViewsHistory = [];
    this.cdr.markForCheck();
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

  /**
   * Create a permalink for a post title
   */
  createPermalink(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '-');
  }

  // View users by date
  viewUsersByDate(date: Date): void {
    if (!this.isAdmin) {
      this.toastr.error('You do not have permission to view user details');
      return;
    }
    
    console.log('viewUsersByDate called with date:', date);
    
    // Check if the date is a string that needs to be converted
    if (typeof date === 'string') {
      date = new Date(date);
    }
    
    // Set up start and end dates based on timeRange
    let startDate: Date;
    let endDate: Date;
    
    if (this.timeRange === 'day') {
      // For day view, get the specific hour
      startDate = new Date(date);
      // Make sure we preserve the hour from the input date
      endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 1);
    } else if (this.timeRange === 'week') {
      // For week/month view, get the specific day
      startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
    } else if (this.timeRange === 'month' || this.timeRange === 'year') {
      // For month/year view, get the specific month
      startDate = new Date(date);
      startDate.setDate(1); // First day of month
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setMonth(startDate.getMonth() + 1); // First day of next month
      endDate.setDate(0); // Last day of current month
      endDate.setHours(23, 59, 59, 999);
    } else {
      // For all time view, get the specific year
      startDate = new Date(date);
      startDate.setMonth(0, 1); // January 1st
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setFullYear(startDate.getFullYear() + 1);
      endDate.setMonth(0, 0); // December 31st
      endDate.setHours(23, 59, 59, 999);
    }
    
    // Debug
    console.log('Date range for viewUsersByDate:', {
      originalDate: date,
      startDate,
      endDate,
      timeRange: this.timeRange
    });
    
    // Query for users created in this time range
    this.loading = true;
    this.cdr.markForCheck();
    
    // Fetch entire users collection and filter in memory for accurate results
    this.firestore.collection('users').get().subscribe(
      (snapshot) => {
        const allUsers = snapshot.docs.map(doc => {
          const data = doc.data() as any;
          let createdAt = null;
          
          try {
            createdAt = this.getDateFromTimestamp(data.createdAt);
            if (createdAt && isNaN(createdAt.getTime())) {
              console.warn('Invalid date from user record:', data.createdAt);
              createdAt = null;
            }
          } catch (error) {
            console.error('Error parsing user createdAt date:', error, data.createdAt);
          }
          
          return {
            id: doc.id,
            ...data,
            createdAt
          };
        });
        
        // Filter users created in the specified time range
        const filteredUsers = allUsers.filter(user => {
          if (!user.createdAt) {
            return false;
          }
          
          try {
            if (isNaN(user.createdAt.getTime())) {
              return false;
            }
            
            // For month/year view, check if user was created in that month/year
            if (this.timeRange === 'month' || this.timeRange === 'year') {
              return user.createdAt.getMonth() === startDate.getMonth() && 
                     user.createdAt.getFullYear() === startDate.getFullYear();
            } else {
              // For other views, check if within exact range
              return user.createdAt >= startDate && user.createdAt <= endDate;
            }
          } catch (error) {
            console.error('Error comparing user date:', error, user);
            return false;
          }
        });
        
        console.log('Users filtering results:', {
          totalUsers: allUsers.length,
          filteredUsers: filteredUsers.length,
          filteredUserIds: filteredUsers.map(u => u.id)
        });
        
        if (filteredUsers.length === 0) {
          // Customize the message based on timeRange
          let periodMessage = '';
          if (this.timeRange === 'day') {
            periodMessage = `at ${this.formatTimeOnly(startDate)}`;
          } else if (this.timeRange === 'week') {
            periodMessage = `on ${this.formatDate(startDate)}`;
          } else if (this.timeRange === 'month' || this.timeRange === 'year') {
            periodMessage = `in ${this.formatMonthYear(startDate)}`;
          } else {
            periodMessage = `in ${startDate.getFullYear()}`;
          }
          
          this.toastr.info(`No users created ${periodMessage}`);
        } else {
          // Prepare title and heading based on timeRange
          let titleFormat = '';
          let periodDescription = '';
          
          if (this.timeRange === 'day') {
            titleFormat = this.formatTimeOnly(startDate);
            periodDescription = `at ${titleFormat}`;
          } else if (this.timeRange === 'week') {
            titleFormat = this.formatDate(startDate);
            periodDescription = `on ${titleFormat}`;
          } else if (this.timeRange === 'month' || this.timeRange === 'year') {
            titleFormat = this.formatMonthYear(startDate);
            periodDescription = `in ${titleFormat}`;
          } else {
            titleFormat = startDate.getFullYear().toString();
            periodDescription = `in ${titleFormat}`;
          }
          
          // Show users in modal
          const usersList = filteredUsers.map(user => 
            `<tr>
              <td>${user.displayName || 'Anonymous'}</td>
              <td>${user.email || 'N/A'}</td>
              <td>${user.role || 'user'}</td>
              <td>${user.createdAt ? user.createdAt.toLocaleString() : 'N/A'}</td>
            </tr>`
          ).join('');
          
          const modalContent = `
            <div class="table-responsive">
              <h6 class="mb-3">Users created ${periodDescription} (${filteredUsers.length})</h6>
              <table class="table table-bordered">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  ${usersList}
                </tbody>
              </table>
            </div>
          `;
          
          // Use SweetAlert2 to show the modal
          Swal.fire({
            title: `Users - ${titleFormat}`,
            html: modalContent,
            width: '800px',
            showCloseButton: true,
            showConfirmButton: false
          });
        }
        
        this.loading = false;
        this.cdr.markForCheck();
      },
      (error) => {
        console.error('Error fetching users by date:', error);
        this.toastr.error('Failed to fetch users');
        this.loading = false;
        this.cdr.markForCheck();
      }
    );
  }
  
  // View posts by date
  viewPostsByDate(date: Date): void {
    if (!this.isAdmin) {
      this.toastr.error('You do not have permission to view post details');
      return;
    }
    
    console.log('viewPostsByDate called with date:', date);
    
    // Check if the date is a string that needs to be converted
    if (typeof date === 'string') {
      date = new Date(date);
    }
    
    // Set up start and end dates based on timeRange
    let startDate: Date;
    let endDate: Date;
    
    if (this.timeRange === 'day') {
      // For day view, get the specific hour
      startDate = new Date(date);
      // Make sure we preserve the hour from the input date
      endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 1);
    } else if (this.timeRange === 'week') {
      // For week/month view, get the specific day
      startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
    } else if (this.timeRange === 'month' || this.timeRange === 'year') {
      // For month/year view, get the specific month
      startDate = new Date(date);
      startDate.setDate(1); // First day of month
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setMonth(startDate.getMonth() + 1); // First day of next month
      endDate.setDate(0); // Last day of current month
      endDate.setHours(23, 59, 59, 999);
    } else {
      // For all time view, get the specific year
      startDate = new Date(date);
      startDate.setMonth(0, 1); // January 1st
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setFullYear(startDate.getFullYear() + 1);
      endDate.setMonth(0, 0); // December 31st
      endDate.setHours(23, 59, 59, 999);
    }
    
    // Debug log
    console.log('Date range for viewPostsByDate:', {
      originalDate: date,
      startDate,
      endDate,
      timeRange: this.timeRange
    });
    
    // Query for posts created in this time range
    this.loading = true;
    this.cdr.markForCheck();
    
    // Fetch all posts and filter in memory
    this.firestore.collection('posts').get().subscribe(
      (snapshot) => {
        const allPosts = snapshot.docs.map(doc => {
          const data = doc.data() as any;
          let createdAt = null;
          
          try {
            createdAt = this.getDateFromTimestamp(data.createdAt);
            if (createdAt && isNaN(createdAt.getTime())) {
              console.warn('Invalid date from post record:', data.createdAt);
              createdAt = null;
            }
          } catch (error) {
            console.error('Error parsing post createdAt date:', error, data.createdAt);
          }
          
          return {
            id: doc.id,
            title: data.title || 'Untitled',
            category: data.category || 'Uncategorized',
            views: data.views || 0,
            likes: data.likes || 0,
            comments: data.comments || 0,
            createdAt,
            createdBy: data.createdBy || 'Unknown'
          };
        });
        
        // Filter posts for the specific time range
        const filteredPosts = allPosts.filter(post => {
          if (!post.createdAt) {
            return false;
          }
          
          try {
            if (isNaN(post.createdAt.getTime())) {
              return false;
            }
            
            // For month/year view, check if post was created in that month/year
            if (this.timeRange === 'month' || this.timeRange === 'year') {
              return post.createdAt.getMonth() === startDate.getMonth() && 
                     post.createdAt.getFullYear() === startDate.getFullYear();
            } else {
              // For other views, check if within exact range
              return post.createdAt >= startDate && post.createdAt <= endDate;
            }
          } catch (error) {
            console.error('Error comparing post date:', error, post);
            return false;
          }
        });
        
        console.log('Posts filtering results:', {
          totalPosts: allPosts.length,
          filteredPosts: filteredPosts.length,
          filteredPostIds: filteredPosts.map(p => p.id)
        });
        
        if (filteredPosts.length === 0) {
          // Customize the message based on timeRange
          let periodMessage = '';
          if (this.timeRange === 'day') {
            periodMessage = `at ${this.formatTimeOnly(startDate)}`;
          } else if (this.timeRange === 'week') {
            periodMessage = `on ${this.formatDate(startDate)}`;
          } else if (this.timeRange === 'month' || this.timeRange === 'year') {
            periodMessage = `in ${this.formatMonthYear(startDate)}`;
          } else {
            periodMessage = `in ${startDate.getFullYear()}`;
          }
          
          this.toastr.info(`No posts created ${periodMessage}`);
        } else {
          // Prepare title and heading based on timeRange
          let titleFormat = '';
          let periodDescription = '';
          
          if (this.timeRange === 'day') {
            titleFormat = this.formatTimeOnly(startDate);
            periodDescription = `at ${titleFormat}`;
          } else if (this.timeRange === 'week') {
            titleFormat = this.formatDate(startDate);
            periodDescription = `on ${titleFormat}`;
          } else if (this.timeRange === 'month' || this.timeRange === 'year') {
            titleFormat = this.formatMonthYear(startDate);
            periodDescription = `in ${titleFormat}`;
          } else {
            titleFormat = startDate.getFullYear().toString();
            periodDescription = `in ${titleFormat}`;
          }
          
          // Show posts in modal
          const postsList = filteredPosts.map(post => 
            `<tr>
              <td>${post.title}</td>
              <td>${this.getCategoryName(post.category)}</td>
              <td>${post.views}</td>
              <td>${post.likes}</td>
              <td>${post.comments}</td>
              <td>
                <a href="/${this.createPermalink(post.title)}-${post.id}" target="_blank" class="btn btn-sm btn-outline-primary">
                  <i class="fas fa-eye"></i> View
                </a>
              </td>
            </tr>`
          ).join('');
          
          const modalContent = `
            <div class="table-responsive">
              <h6 class="mb-3">Posts created ${periodDescription} (${filteredPosts.length})</h6>
              <table class="table table-bordered">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Views</th>
                    <th>Likes</th>
                    <th>Comments</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${postsList}
                </tbody>
              </table>
            </div>
          `;
          
          // Use SweetAlert2 to show the modal
          Swal.fire({
            title: `Posts - ${titleFormat}`,
            html: modalContent,
            width: '800px',
            showCloseButton: true,
            showConfirmButton: false
          });
        }
        
        this.loading = false;
        this.cdr.markForCheck();
      },
      (error) => {
        console.error('Error fetching posts by date:', error);
        this.toastr.error('Failed to fetch posts');
        this.loading = false;
        this.cdr.markForCheck();
      }
    );
  }

  // View posts by category
  viewPostsByCategory(categoryName: string): void {
    if (!this.isAdmin) {
      this.toastr.error('You do not have permission to view post details');
      return;
    }
    
    this.loading = true;
    this.cdr.markForCheck();
    
    // Fetch all posts
    this.firestore.collection('posts').get().subscribe(
      (snapshot) => {
        const allPosts = snapshot.docs.map(doc => {
          const data = doc.data() as any;
          const createdAt = this.getDateFromTimestamp(data.createdAt);
          return {
            id: doc.id,
            title: data.title || 'Untitled',
            category: data.category || 'Uncategorized',
            views: data.views || 0,
            likes: data.likes || 0,
            comments: data.comments || 0,
            createdAt,
            createdBy: data.createdBy || 'Unknown'
          };
        });
        
        // Filter posts by category
        const filteredPosts = allPosts.filter(post => {
          const postCategoryName = this.getCategoryName(post.category);
          return postCategoryName === categoryName;
        });
        
        console.log('Category posts filtering:', {
          categoryName,
          totalPosts: allPosts.length,
          filteredPosts: filteredPosts.length
        });
        
        if (filteredPosts.length === 0) {
          this.toastr.info(`No posts found in category: ${categoryName}`);
          this.loading = false;
          this.cdr.markForCheck();
          return;
        }
        
        // Create posts table
        const postsList = filteredPosts.map(post => 
          `<tr>
            <td>${post.title}</td>
            <td>${post.views}</td>
            <td>${post.likes}</td>
            <td>${post.comments}</td>
            <td>${this.getDateFromTimestamp(post.createdAt)?.toLocaleDateString() || 'N/A'}</td>
            <td>
              <a href="/${this.createPermalink(post.title)}-${post.id}" target="_blank" class="btn btn-sm btn-outline-primary">
                <i class="fas fa-eye"></i> View
              </a>
            </td>
          </tr>`
        ).join('');
        
        const modalContent = `
          <div class="table-responsive">
            <h6 class="mb-3">${filteredPosts.length} posts in "${categoryName}" category</h6>
            <table class="table table-bordered table-hover">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Views</th>
                  <th>Likes</th>
                  <th>Comments</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${postsList}
              </tbody>
            </table>
          </div>
        `;
        
        // Use SweetAlert2 to show the modal
        Swal.fire({
          title: `${categoryName} Posts`,
          html: modalContent,
          width: '900px',
          showCloseButton: true,
          showConfirmButton: false
        });
        
        this.loading = false;
        this.cdr.markForCheck();
      },
      (error) => {
        console.error('Error fetching posts for category:', error);
        this.toastr.error('Failed to fetch posts for category');
        this.loading = false;
        this.cdr.markForCheck();
      }
    );
  }

  // Helper method to format just time portion
  formatTimeOnly(date: Date): string {
    if (!date) return 'N/A';
    
    try {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return 'Invalid Time';
    }
  }
  
  // Helper method to format month and year
  formatMonthYear(date: Date): string {
    if (!date) return 'N/A';
    
    try {
      return date.toLocaleDateString([], { month: 'long', year: 'numeric' });
    } catch (error) {
      return 'Invalid Date';
    }
  }
} 