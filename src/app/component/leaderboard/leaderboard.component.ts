import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaderboardService, LeaderboardEntry } from '../../services/leaderboard.service';
import { AuthService } from '../../services/auth.service';
import { Observable } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.css']
})
export class LeaderboardComponent implements OnInit {
  topUsers$: Observable<LeaderboardEntry[]>;
  currentUserRank: number = 0;
  currentUserEntry: LeaderboardEntry | null = null;
  stats: { totalUsers: number, totalQuestionsCompleted: number } = { totalUsers: 0, totalQuestionsCompleted: 0 };
  isLoading: boolean = true;

  constructor(
    private leaderboardService: LeaderboardService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.topUsers$ = this.leaderboardService.getTopUsers(20);
  }

  ngOnInit(): void {
    this.loadLeaderboardData();
  }

  loadLeaderboardData(): void {
    // Get top users
    this.topUsers$.subscribe(
      users => {
        this.isLoading = false;
      },
      error => {
        this.isLoading = false;
        this.toastr.error('Error loading leaderboard data');
        console.error('Error loading leaderboard data:', error);
      }
    );

    // Get leaderboard stats
    this.leaderboardService.getLeaderboardStats().subscribe(
      stats => {
        this.stats = stats;
      },
      error => {
        console.error('Error loading leaderboard stats:', error);
      }
    );

    // Get current user's rank and entry if logged in
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      const userId = currentUser.uid || (currentUser.user && currentUser.user.uid);
      
      if (userId) {
        this.leaderboardService.getUserRanking(userId).subscribe(
          rank => {
            this.currentUserRank = rank;
          },
          error => {
            console.error('Error loading user ranking:', error);
          }
        );

        this.leaderboardService.getUserEntry(userId).subscribe(
          entry => {
            this.currentUserEntry = entry;
          },
          error => {
            console.error('Error loading user entry:', error);
          }
        );
      }
    }
  }

  // Get CSS class for rank
  getRankClass(index: number): string {
    switch (index) {
      case 0:
        return 'rank-gold';
      case 1:
        return 'rank-silver';
      case 2:
        return 'rank-bronze';
      default:
        return '';
    }
  }

  // Format date
  formatDate(date: any): string {
    if (!date) return 'N/A';
    
    if (date.toDate) {
      date = date.toDate();
    }
    
    return new Date(date).toLocaleDateString();
  }
} 