import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

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
}

interface DashboardData {
  recentPosts: Post[];
  popularPosts: Post[];
  recommendedQuestions: Question[];
  userProgress: {
    started: number;
    completed: number;
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

  constructor(
    private firestore: AngularFirestore,
    private auth: AngularFireAuth
  ) {
    this.dashboardData$ = of(null).pipe(
      switchMap(() => this.getDashboardData())
    );
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

    // Get questions
    const questions$ = this.firestore.collection<Question>('questions').snapshotChanges().pipe(
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
      userProgress$
    ]).pipe(
      map(([recentPosts, popularPosts, questions, userProgress]) => {
        // Calculate categories from posts
        const categoryCounts: { [key: string]: number } = {};
        recentPosts.concat(popularPosts).forEach(post => {
          if (post.category) {
            categoryCounts[post.category] = (categoryCounts[post.category] || 0) + 1;
          }
        });

        const categories = Object.keys(categoryCounts).map(name => ({
          name,
          count: categoryCounts[name]
        })).sort((a, b) => b.count - a.count);

        // Calculate user progress
        const startedCount = userProgress.filter(p => p.status === 'started').length;
        const completedCount = userProgress.filter(p => p.status === 'completed').length;

        // Get recommended questions based on user progress
        const completedQuestionIds = userProgress
          .filter(p => p.status === 'completed')
          .map(p => p.questionId);

        const recommendedQuestions = questions
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
            total: questions.length
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
} 