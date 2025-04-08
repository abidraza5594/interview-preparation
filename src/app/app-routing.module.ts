import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './component/home/home.component';
import { AuthComponent } from './component/auth/auth.component';
import { ContactUsComponent } from './component/contact-us/contact-us.component';
import { AboutUsComponent } from './component/about-us/about-us.component';
import { PostsDetailsComponent } from './component/posts-details/posts-details.component';
import { AuthGuard } from './services/auth.guard';
import { PrivacyPolicyComponent } from './component/privacy-policy/privacy-policy.component';

// New Components
import { DashboardComponent } from './component/dashboard/dashboard.component';
import { PracticeComponent } from './component/practice/practice.component';
import { UserManagementComponent } from './component/user-management/user-management.component';
import { AnalyticsComponent } from './component/analytics/analytics.component';
import { ProfileComponent } from './component/profile/profile.component';
import { SettingsComponent } from './component/settings/settings.component';
import { CreatePostComponent } from './component/create-post/create-post.component';
import { CreatePracticeComponent } from './component/create-practice/create-practice.component';
import { LeaderboardComponent } from './component/leaderboard/leaderboard.component';
import { PracticeDetailsComponent } from './component/practice-details/practice-details.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'auth', component: AuthComponent },
  { path: 'contact-us', component: ContactUsComponent },
  { path: 'about-us', component: AboutUsComponent},
  { path: 'privacy-policy', component: PrivacyPolicyComponent },
  
  // New Routes - These must come BEFORE the wildcard route
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'practice', component: PracticeComponent },
  { path: 'practice/:id', loadComponent: () => import('./component/practice-details/practice-details.component').then(m => m.PracticeDetailsComponent) },
  { path: 'user-management', component: UserManagementComponent, canActivate: [AuthGuard] },
  { path: 'analytics', component: AnalyticsComponent, canActivate: [AuthGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [AuthGuard] },
  { path: 'create-post', component: CreatePostComponent, canActivate: [AuthGuard] },
  { path: 'create-practice', component: CreatePracticeComponent, canActivate: [AuthGuard] },
  { path: 'leaderboard', component: LeaderboardComponent },
  { path: 'mock-interview', loadComponent: () => import('./component/mock-interview/mock-interview.component').then(m => m.MockInterviewComponent) },
  
  // Category route
  { path: 'category/:id', loadComponent: () => import('./component/category-posts/category-posts.component').then(m => m.CategoryPostsComponent) },
  
  // Wildcard route should be LAST
  { path: ':id', component: PostsDetailsComponent},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
