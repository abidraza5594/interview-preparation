import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './component/home/home.component';
import { AuthComponent } from './component/auth/auth.component';
import { ContactUsComponent } from './component/contact-us/contact-us.component';
import { AboutUsComponent } from './component/about-us/about-us.component';
import { PostsDetailsComponent } from './component/posts-details/posts-details.component';
import { AuthGuard } from './services/auth.guard';
import { PrivacyPolicyComponent } from './component/privacy-policy/privacy-policy.component';
import { AdminGuard } from './services/admin.guard';

// New Components
import { DashboardComponent } from './component/dashboard/dashboard.component';
import { PracticeComponent } from './component/practice/practice.component';
import { PracticeDetailsComponent } from './component/practice-details/practice-details.component';
import { UserManagementComponent } from './component/user-management/user-management.component';
import { AnalyticsComponent } from './component/analytics/analytics.component';
import { ProfileComponent } from './component/profile/profile.component';
import { SettingsComponent } from './component/settings/settings.component';
import { CreatePostComponent } from './component/create-post/create-post.component';
import { CreatePracticeComponent } from './component/create-practice/create-practice.component';
import { LeaderboardComponent } from './component/leaderboard/leaderboard.component';
import { CodePlaygroundComponent } from './component/code-playground/code-playground.component';
import { AdminFixerComponent } from './component/user-management/admin-fixer.component';
import { AdminCheckComponent } from './component/user-management/admin-check.component';
import { MockInterviewComponent } from './component/mock-interview/mock-interview.component';
import { CategoryPostsComponent } from './component/category-posts/category-posts.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'auth', component: AuthComponent },
  { path: 'contact-us', component: ContactUsComponent },
  { path: 'about-us', component: AboutUsComponent},
  { path: 'privacy-policy', component: PrivacyPolicyComponent },
  
  // New Routes - These must come BEFORE the wildcard route
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'practice', component: PracticeComponent },
  { path: 'practice/:id', component: PracticeDetailsComponent },
  { path: 'playground', component: CodePlaygroundComponent },
  { path: 'user-management', component: UserManagementComponent, canActivate: [AuthGuard, AdminGuard] },
  { path: 'analytics', component: AnalyticsComponent, canActivate: [AuthGuard, AdminGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [AuthGuard] },
  { path: 'create-post', component: CreatePostComponent, canActivate: [AuthGuard, AdminGuard] },
  { path: 'create-practice', component: CreatePracticeComponent, canActivate: [AuthGuard, AdminGuard] },
  { path: 'leaderboard', component: LeaderboardComponent },
  { path: 'mock-interview', component: MockInterviewComponent },
  { path: 'admin-fix', component: AdminFixerComponent, canActivate: [AuthGuard] },
  { path: 'admin-check', component: AdminCheckComponent },
  
  // Category route
  { path: 'category/:id', component: CategoryPostsComponent },
  
  // Wildcard route should be LAST
  { path: ':id', component: PostsDetailsComponent},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
