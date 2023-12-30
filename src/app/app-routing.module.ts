import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './component/home/home.component';
import { AuthComponent } from './component/auth/auth.component';
import { ContactUsComponent } from './component/contact-us/contact-us.component';
import { AboutUsComponent } from './component/about-us/about-us.component';
import { PostsDetailsComponent } from './component/posts-details/posts-details.component';
import { AuthGuard } from './services/auth.guard';
const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'auth', component: AuthComponent },
  { path: 'contact-us', component: ContactUsComponent },
  { path: 'about-us', component: AboutUsComponent},
  // { path: 'posts/:category/:id', component: PostsDetailsComponent },
  // { path: ':id', component: PostsDetailsComponent ,canActivate:[AuthGuard]},  
  { path: ':id', component: PostsDetailsComponent},  
];
@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
