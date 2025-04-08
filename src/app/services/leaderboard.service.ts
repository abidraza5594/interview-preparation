import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, combineLatest, map, of, switchMap, from } from 'rxjs';
import firebase from 'firebase/compat/app';

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  photoURL?: string;
  questionsCompleted: number;
  score: number;
  lastActive: firebase.firestore.Timestamp | Date;
}

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {

  constructor(private firestore: AngularFirestore) { }

  // Get the top users by questions completed
  getTopUsers(limit: number = 10): Observable<LeaderboardEntry[]> {
    return this.firestore.collection<LeaderboardEntry>('leaderboard', 
      ref => ref.orderBy('questionsCompleted', 'desc').limit(limit))
      .snapshotChanges()
      .pipe(
        map(actions => actions.map(a => {
          const data = a.payload.doc.data() as LeaderboardEntry;
          const id = a.payload.doc.id;
          return { ...data, id };
        }))
      );
  }

  // Get a user's leaderboard entry
  getUserEntry(userId: string): Observable<LeaderboardEntry | null> {
    return this.firestore.doc<LeaderboardEntry>(`leaderboard/${userId}`)
      .snapshotChanges()
      .pipe(
        map(action => {
          if (action.payload.exists) {
            const data = action.payload.data() as LeaderboardEntry;
            return { ...data, id: action.payload.id };
          } else {
            return null;
          }
        })
      );
  }

  // Update a user's leaderboard entry when they complete a question
  updateUserScore(userId: string, displayName: string, photoURL: string | null, questionDifficulty: string): Observable<void> {
    // Calculate score based on difficulty
    let scoreIncrement = 0;
    switch (questionDifficulty.toLowerCase()) {
      case 'easy':
        scoreIncrement = 10;
        break;
      case 'medium':
        scoreIncrement = 20;
        break;
      case 'hard':
        scoreIncrement = 30;
        break;
      default:
        scoreIncrement = 10;
    }

    return this.getUserEntry(userId).pipe(
      switchMap(entry => {
        const now = firebase.firestore.Timestamp.now();
        
        if (entry) {
          // Update existing entry
          return from(this.firestore.doc(`leaderboard/${userId}`).update({
            questionsCompleted: firebase.firestore.FieldValue.increment(1),
            score: firebase.firestore.FieldValue.increment(scoreIncrement),
            lastActive: now,
            displayName: displayName || entry.displayName,
            photoURL: photoURL || entry.photoURL
          }));
        } else {
          // Create new entry
          return from(this.firestore.doc(`leaderboard/${userId}`).set({
            userId,
            displayName: displayName || 'Anonymous',
            photoURL: photoURL,
            questionsCompleted: 1,
            score: scoreIncrement,
            lastActive: now
          }));
        }
      })
    );
  }

  // Get user ranking
  getUserRanking(userId: string): Observable<number> {
    return this.firestore.collection<LeaderboardEntry>('leaderboard', 
      ref => ref.orderBy('questionsCompleted', 'desc'))
      .snapshotChanges()
      .pipe(
        map(actions => {
          const index = actions.findIndex(a => a.payload.doc.id === userId);
          return index !== -1 ? index + 1 : 0; // Return 0 if user not found
        })
      );
  }

  // Get leaderboard statistics
  getLeaderboardStats(): Observable<{totalUsers: number, totalQuestionsCompleted: number}> {
    return this.firestore.collection<LeaderboardEntry>('leaderboard')
      .snapshotChanges()
      .pipe(
        map(actions => {
          const totalUsers = actions.length;
          const totalQuestionsCompleted = actions.reduce((sum, a) => {
            const data = a.payload.doc.data() as LeaderboardEntry;
            return sum + data.questionsCompleted;
          }, 0);
          
          return { totalUsers, totalQuestionsCompleted };
        })
      );
  }
} 