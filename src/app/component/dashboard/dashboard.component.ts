import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

interface Post {
  id?: string;
  title: string;
  content: string;
  category: string;
  createdAt: any;
  createdBy: string;
  likes: number;
  views: number;
}

interface Question {
  id?: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  createdAt: any;
  createdBy: string;
}

interface UserProgress {
  questionId: string;
  status: 'started' | 'completed';
  lastUpdated: any;
  questionType?: 'coding' | 'mcq';
}

interface DashboardData {
  recentPosts: Post[];
  popularPosts: Post[];
  recommendedQuestions: Question[];
  userProgress: {
    started: number;
    completed: number;
    codingCompleted: number;
    mcqCompleted: number;
    total: number;
  };
  categories: {
    name: string;
    count: number;
  }[];
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  dashboardData$: Observable<DashboardData>;
  loading = true;
  userEmail: string | null = null;
  userId: string | null = null;
  isAdmin$: Observable<boolean>;

  constructor(
    private firestore: AngularFirestore,
    private auth: AngularFireAuth,
    private authService: AuthService
  ) {
    this.dashboardData$ = of(null).pipe(
      switchMap(() => this.getDashboardData())
    );
    
    this.isAdmin$ = this.authService.isAdmin();
  }

  ngOnInit(): void {
    this.auth.user.subscribe(user => {
      if (user) {
        this.userEmail = user.email;
        this.userId = user.uid;
      }
      this.loading = false;
    });
  }

  getDashboardData(): Observable<DashboardData> {
    // Get recent posts
    const recentPosts$ = this.firestore.collection<Post>('posts', ref => 
      ref.orderBy('createdAt', 'desc').limit(5)
    ).snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as Post;
        const id = a.payload.doc.id;
        return { id, ...data };
      }))
    );

    // Get popular posts
    const popularPosts$ = this.firestore.collection<Post>('posts', ref => 
      ref.orderBy('views', 'desc').limit(5)
    ).snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as Post;
        const id = a.payload.doc.id;
        return { id, ...data };
      }))
    );

    // Get both practice questions and MCQs
    const questions$ = this.firestore.collection<Question>('questions').snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as Question;
        const id = a.payload.doc.id;
        return { id, ...data };
      }))
    );
    
    const mcqQuestions$ = this.firestore.collection<Question>('mcq-questions').snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as Question;
        const id = a.payload.doc.id;
        return { id, ...data };
      }))
    );

    // Get user progress if user is logged in
    const userProgress$ = this.userId ? 
      this.firestore.collection<UserProgress>(`users/${this.userId}/progress`).valueChanges() : 
      of([]);

    return combineLatest([
      recentPosts$,
      popularPosts$,
      questions$,
      mcqQuestions$,
      userProgress$
    ]).pipe(
      map(([recentPosts, popularPosts, questions, mcqQuestions, userProgress]) => {
        console.log('questions', questions);
        console.log('mcqQuestions', mcqQuestions);
        console.log('userProgress', userProgress);
        console.log('recentPosts', recentPosts);
        console.log('popularPosts', popularPosts);
        console.log('mcqQuestions', mcqQuestions);
        // Calculate categories from posts
        const categoryCounts: { [key: string]: number } = {};
        recentPosts.concat(popularPosts).forEach(post => {
          if (post.category) {
            // Handle different types of category data
            let categoryName = post.category;
            
            // If category is an object with id and name properties
            if (typeof post.category === 'object' && post.category !== null) {
              // Try to get the name from the category object
              const categoryObj = post.category as any;
              if (categoryObj.name) {
                categoryName = categoryObj.name;
              } else if (categoryObj.id) {
                categoryName = categoryObj.id;
              } else if (categoryObj.toString) {
                categoryName = categoryObj.toString();
              }
            }
            
            // Clean up the category name to ensure it's always a string and never [object Object]
            let categoryKey: string;
            if (categoryName === null || categoryName === undefined) {
              categoryKey = 'Uncategorized';
            } else if (typeof categoryName === 'object') {
              // If still somehow an object after all the checks, use JSON stringify
              categoryKey = JSON.stringify(categoryName);
              if (categoryKey === '[object Object]' || categoryKey.includes('[object Object]')) {
                categoryKey = 'Uncategorized';
              }
            } else {
              categoryKey = String(categoryName);
            }
            
            // Skip any category that's still [object Object]
            if (categoryKey !== '[object Object]') {
              categoryCounts[categoryKey] = (categoryCounts[categoryKey] || 0) + 1;  
            }
          }
        });

        const categories = Object.keys(categoryCounts).map(name => ({
          name,
          count: categoryCounts[name]
        })).sort((a, b) => b.count - a.count);
        console.log('categories', categories);

        // Calculate user progress
        const startedCount = userProgress.filter(p => p.status === 'started').length;
        const completedCount = userProgress.filter(p => p.status === 'completed').length;
        
        // Calculate totals by question type
        const codingCompletedCount = userProgress.filter(p => p.status === 'completed' && p.questionType === 'coding').length;
        const mcqCompletedCount = userProgress.filter(p => p.status === 'completed' && p.questionType === 'mcq').length;
        
        const allQuestions = [...questions, ...mcqQuestions];
        const totalQuestions = allQuestions.length;

        // Get recommended questions based on user progress
        const completedQuestionIds = userProgress
          .filter(p => p.status === 'completed')
          .map(p => p.questionId);

        const recommendedQuestions = allQuestions
          .filter(q => !completedQuestionIds.includes(q.id!))
          .sort((a, b) => {
            // Sort by difficulty (easy first)
            const difficultyOrder = { 'easy': 0, 'medium': 1, 'hard': 2 };
            return (difficultyOrder[a.difficulty as keyof typeof difficultyOrder] || 0) - 
                   (difficultyOrder[b.difficulty as keyof typeof difficultyOrder] || 0);
          })
          .slice(0, 5);

        return {
          recentPosts,
          popularPosts,
          recommendedQuestions,
          userProgress: {
            started: startedCount,
            completed: completedCount,
            codingCompleted: codingCompletedCount,
            mcqCompleted: mcqCompletedCount,
            total: totalQuestions
          },
          categories
        };
      })
    );
  }

  formatDate(date: any): string {
    if (!date) return '';
    
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return d.toLocaleDateString();
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