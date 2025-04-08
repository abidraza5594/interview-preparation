import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Observable, from, map, switchMap, tap, take } from 'rxjs';
import { AuthService } from './auth.service';
import { LeaderboardService } from './leaderboard.service';
import firebase from 'firebase/compat/app';

export interface PracticeQuestion {
  id?: string;
  title: string;
  description: string;
  category: string;
  categoryName?: string;
  difficulty: string;
  questionType: 'multiple-choice' | 'coding';
  options: {
    text: string;
    isCorrect: boolean;
  }[];
  solution: string;
  hints: {
    text: string;
  }[];
  codeTemplate?: string;
  testCases?: {
    input: string;
    expectedOutput: string;
    isHidden: boolean;
  }[];
  timeLimit?: number;
  memoryLimit?: number;
  tags: string[];
  isPublished: boolean;
  createdAt: firebase.firestore.Timestamp | Date;
  updatedAt: firebase.firestore.Timestamp | Date;
  createdBy: string;
  createdByDisplayName: string;
  createdByPhotoURL?: string;
  views: number;
  likes: number;
  attempts: number;
  successRate: number;
  solvedBy?: string[];
  userLiked?: boolean;
  userDisliked?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PracticeService {

  constructor(
    private firestore: AngularFirestore,
    private storage: AngularFireStorage,
    private authService: AuthService,
    private leaderboardService: LeaderboardService
  ) { }

  // Create a new practice question
  createPracticeQuestion(practiceData: Partial<PracticeQuestion>): Observable<string> {
    const id = this.firestore.createId();
    const timestamp = firebase.firestore.Timestamp.now();
    
    // Get the current user directly instead of expecting an Observable
    const user = this.authService.getCurrentUser();
    
    if (!user) {
      throw new Error('User must be logged in to create a practice question');
    }
    
    // Extract user properties
    const userId = user.uid || (user.user && user.user.uid);
    const displayName = user.displayName || (user.user && user.user.displayName) || 'Anonymous';
    const photoURL = user.photoURL || (user.user && user.user.photoURL) || null;
    
    // Create a clean copy of practiceData without any undefined values
    const cleanPracticeData: Record<string, any> = { ...practiceData };
    
    // Replace any undefined values with null
    Object.keys(cleanPracticeData).forEach(key => {
      if (cleanPracticeData[key] === undefined) {
        cleanPracticeData[key] = null;
      }
    });
    
    const newPractice: Record<string, any> = {
      ...cleanPracticeData,
      id,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: userId,
      createdByDisplayName: displayName,
      createdByPhotoURL: photoURL,
      views: 0,
      likes: 0,
      attempts: 0,
      successRate: 0
    };
    
    // Convert any remaining undefined values to null
    Object.keys(newPractice).forEach(key => {
      if (newPractice[key] === undefined) {
        newPractice[key] = null;
      }
    });
    
    return from(this.firestore.collection('practice-questions').doc(id).set(newPractice as PracticeQuestion))
      .pipe(map(() => id));
  }

  // Get all practice questions
  getAllPracticeQuestions(): Observable<PracticeQuestion[]> {
    // Instead of using where and orderBy together (which requires an index),
    // we'll get all documents and filter them in memory
    return this.firestore.collection<PracticeQuestion>('practice-questions')
      .snapshotChanges()
      .pipe(
        take(1), // Only take the first emission to prevent infinite updates
        map(actions => actions.map(a => {
          const data = a.payload.doc.data() as PracticeQuestion;
          const id = a.payload.doc.id;
          return { id, ...data };
        })),
        // Filter and sort in memory
        map(questions => questions
          .filter(question => question.isPublished === true)
          .sort((a, b) => {
            // Convert to timestamps if they're Date objects
            const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : a.createdAt.toMillis();
            const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : b.createdAt.toMillis();
            return dateB - dateA; // descending order
          })
        )
      );
  }

  // Get practice questions by category
  getPracticeQuestionsByCategory(categoryId: string): Observable<PracticeQuestion[]> {
    return this.firestore.collection<PracticeQuestion>('practice-questions', 
      ref => ref.where('category', '==', categoryId)
                .where('isPublished', '==', true)
                .orderBy('createdAt', 'desc'))
      .snapshotChanges()
      .pipe(
        map(actions => actions.map(a => {
          const data = a.payload.doc.data() as PracticeQuestion;
          const id = a.payload.doc.id;
          return { id, ...data };
        }))
      );
  }

  // Get practice questions by difficulty
  getPracticeQuestionsByDifficulty(difficulty: string): Observable<PracticeQuestion[]> {
    return this.firestore.collection<PracticeQuestion>('practice-questions', 
      ref => ref.where('difficulty', '==', difficulty)
                .where('isPublished', '==', true)
                .orderBy('createdAt', 'desc'))
      .snapshotChanges()
      .pipe(
        map(actions => actions.map(a => {
          const data = a.payload.doc.data() as PracticeQuestion;
          const id = a.payload.doc.id;
          return { id, ...data };
        }))
      );
  }

  // Get practice questions by user
  getPracticeQuestionsByUser(userId: string): Observable<PracticeQuestion[]> {
    return this.firestore.collection<PracticeQuestion>('practice-questions', 
      ref => ref.where('createdBy', '==', userId)
                .orderBy('createdAt', 'desc'))
      .snapshotChanges()
      .pipe(
        map(actions => actions.map(a => {
          const data = a.payload.doc.data() as PracticeQuestion;
          const id = a.payload.doc.id;
          return { id, ...data };
        }))
      );
  }

  // Get a single practice question by ID
  getPracticeQuestionById(id: string): Observable<PracticeQuestion | null> {
    return this.firestore.doc<PracticeQuestion>(`practice-questions/${id}`)
      .snapshotChanges()
      .pipe(
        take(1), // Only take the first emission to prevent infinite updates
        map(action => {
          if (action.payload.exists) {
            const data = action.payload.data() as PracticeQuestion;
            return { id: action.payload.id, ...data };
          } else {
            return null;
          }
        })
      );
  }

  // Update a practice question
  updatePracticeQuestion(id: string, data: Partial<PracticeQuestion>): Observable<void> {
    const updateData = {
      ...data,
      updatedAt: firebase.firestore.Timestamp.now()
    };
    
    return from(this.firestore.collection('practice-questions').doc(id).update(updateData));
  }

  // Delete a practice question
  deletePracticeQuestion(id: string): Observable<void> {
    return from(this.firestore.collection('practice-questions').doc(id).delete());
  }

  // Increment view count
  incrementViewCount(id: string): Observable<void> {
    const increment = firebase.firestore.FieldValue.increment(1);
    return from(this.firestore.collection('practice-questions').doc(id).update({
      views: increment
    }));
  }

  // Like a practice question
  likePracticeQuestion(id: string, isLike: boolean = true): Observable<void> {
    const increment = firebase.firestore.FieldValue.increment(isLike ? 1 : -1);
    return from(this.firestore.collection('practice-questions').doc(id).update({
      likes: increment
    }));
  }

  // Dislike a practice question
  dislikePracticeQuestion(id: string): Observable<void> {
    return this.likePracticeQuestion(id, false);
  }

  // Record an attempt
  recordAttempt(id: string, isCorrect: boolean): Observable<void> {
    const increment = firebase.firestore.FieldValue.increment(1);
    
    return this.getPracticeQuestionById(id).pipe(
      switchMap(question => {
        if (!question) {
          throw new Error('Question not found');
        }
        
        const currentAttempts = question.attempts || 0;
        const currentSuccessful = currentAttempts * (question.successRate || 0) / 100;
        const newSuccessful = isCorrect ? currentSuccessful + 1 : currentSuccessful;
        const newAttempts = currentAttempts + 1;
        const newSuccessRate = (newSuccessful / newAttempts) * 100;
        
        // Update the question stats
        return from(this.firestore.collection('practice-questions').doc(id).update({
          attempts: increment,
          successRate: newSuccessRate
        })).pipe(
          tap(() => {
            // If the attempt was successful, update the leaderboard
            if (isCorrect) {
              const user = this.authService.getCurrentUser();
              if (user) {
                const userId = user.uid || (user.user && user.user.uid);
                const displayName = user.displayName || (user.user && user.user.displayName) || 'Anonymous';
                const photoURL = user.photoURL || (user.user && user.user.photoURL) || null;
                
                if (userId) {
                  // Update the user's score on the leaderboard
                  this.leaderboardService.updateUserScore(
                    userId, 
                    displayName, 
                    photoURL, 
                    question.difficulty
                  ).subscribe();
                  
                  // Add user to the solvedBy array if not already there
                  if (!question.solvedBy || !question.solvedBy.includes(userId)) {
                    const solvedBy = question.solvedBy || [];
                    solvedBy.push(userId);
                    this.firestore.collection('practice-questions').doc(id).update({
                      solvedBy
                    });
                  }
                }
              }
            }
          })
        );
      })
    );
  }

  // Search practice questions
  searchPracticeQuestions(searchTerm: string): Observable<PracticeQuestion[]> {
    // Firebase doesn't support full-text search natively
    // This is a simple implementation that searches in title only
    return this.getAllPracticeQuestions().pipe(
      map(questions => {
        const term = searchTerm.toLowerCase();
        return questions.filter(question => 
          question.title.toLowerCase().includes(term) || 
          (question.tags && question.tags.some(tag => tag.toLowerCase().includes(term)))
        );
      })
    );
  }
} 