import { NgModule } from '@angular/core';
import { ToastrModule } from 'ngx-toastr';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthComponent } from './component/auth/auth.component';
import { HomeComponent } from './component/home/home.component';
import { LetetsPostsComponent } from './component/letets-posts/letets-posts.component';
import { FrontEndComponent } from './component/FrontEnd-posts/frontend.component';
import { BackEndPostsComponent } from './component/BackEnd-posts/backend.component';
import { ContactUsComponent } from './component/contact-us/contact-us.component';
import { NavbarComponent } from './component/navbar/navbar.component';
import { AboutUsComponent } from './component/about-us/about-us.component';
import { PostsDetailsComponent } from './component/posts-details/posts-details.component';
// firese base 
import {AngularFireModule,} from "@angular/fire/compat"
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { LogoComponent } from './component/logo/logo.component'
const enviroment={
  firebase: {
     apiKey: "AIzaSyB9s3N-ytJfSrwc3DNHXOxTaQ41Y-hSqTU",
     authDomain: "my-blogs-1688124392168.firebaseapp.com",
     projectId: "my-blogs-1688124392168",
     storageBucket: "my-blogs-1688124392168.appspot.com",
     messagingSenderId: "874380399101",
     appId: "1:874380399101:web:42fa37fe992c3a12e34994",
     measurementId: "G-8T9WRXX983"
   }
}

@NgModule({
  declarations: [
    AppComponent,
    AuthComponent,
    HomeComponent,
    LetetsPostsComponent,
    FrontEndComponent,
    BackEndPostsComponent,
    ContactUsComponent,
    NavbarComponent,
    AboutUsComponent,
    PostsDetailsComponent,
    LogoComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule,
    // fire base 
    AngularFireModule.initializeApp(enviroment.firebase),
    AngularFirestoreModule,
    AngularFireAuthModule,
    BrowserAnimationsModule,
    ToastrModule.forRoot(),
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
