import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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
import { PrivacyPolicyComponent } from './component/privacy-policy/privacy-policy.component';
// firese base
import {AngularFireModule,} from "@angular/fire/compat"
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFireStorageModule } from '@angular/fire/compat/storage';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { LogoComponent } from './component/logo/logo.component'
import { HttpClientModule } from '@angular/common/http';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';

// Material modules
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatOptionModule } from '@angular/material/core';

// New Components
import { DashboardComponent } from './component/dashboard/dashboard.component';
import { UserManagementComponent } from './component/user-management/user-management.component';
import { AnalyticsComponent } from './component/analytics/analytics.component';
import { ProfileComponent } from './component/profile/profile.component';
import { SettingsComponent } from './component/settings/settings.component';
import { CreatePostComponent } from './component/create-post/create-post.component';
import { CreatePracticeComponent } from './component/create-practice/create-practice.component';
import { GoogleAdComponent } from './component/google-ad/google-ad.component';
import { MockInterviewModule } from './component/mock-interview/mock-interview/mock-interview.module';
import { PracticeComponent } from './component/practice/practice.component';
import { PracticeDetailsComponent } from './component/practice-details/practice-details.component';
import { CodePlaygroundComponent } from './component/code-playground/code-playground.component';
import { MockInterviewComponent } from './component/mock-interview/mock-interview.component';
import { CategoryPostsComponent } from './component/category-posts/category-posts.component';

// Import our mock Quill module instead of the real one
import { QuillModule } from './mock-quill.module';

// Import highlight.js styles
import 'highlight.js/styles/vs2015.css';
// Import highlight.js languages
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import java from 'highlight.js/lib/languages/java';
import python from 'highlight.js/lib/languages/python';
import csharp from 'highlight.js/lib/languages/csharp';
import php from 'highlight.js/lib/languages/php';
import sql from 'highlight.js/lib/languages/sql';

// Register the languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);
hljs.registerLanguage('java', java);
hljs.registerLanguage('python', python);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('php', php);
hljs.registerLanguage('sql', sql);

// Import monaco directly - temporarily commented out for build
// import * as monaco from 'monaco-editor';

// Extend window interface to allow monaco assignment
declare global {
  interface Window {
    monaco: any;
  }
}

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
    PrivacyPolicyComponent,
    // New Components that are NOT standalone
    DashboardComponent,
    UserManagementComponent,
    AnalyticsComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule,
    RouterModule,
    HttpClientModule,
    // Mock Interview Module
    MockInterviewModule,
    // fire base
    AngularFireModule.initializeApp(enviroment.firebase),
    AngularFirestoreModule,
    AngularFireAuthModule,
    AngularFireStorageModule,
    BrowserAnimationsModule,
    ToastrModule.forRoot(),

    // Material modules
    MatAutocompleteModule,
    MatInputModule,
    MatFormFieldModule,
    MatOptionModule,

    // Monaco editor is now imported directly

    // Quill rich text editor
    QuillModule.forRoot({
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline', 'strike'],
          ['blockquote', 'code-block'],
          [{ 'header': 1 }, { 'header': 2 }],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          [{ 'script': 'sub'}, { 'script': 'super' }],
          [{ 'indent': '-1'}, { 'indent': '+1' }],
          [{ 'direction': 'rtl' }],
          [{ 'size': ['small', false, 'large', 'huge'] }],
          [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'font': [] }],
          [{ 'align': [] }],
          ['clean'],
          ['link', 'image', 'video']
        ]
      }
    }),

    // Standalone components
    GoogleAdComponent,
    ProfileComponent,
    SettingsComponent,
    CreatePostComponent,
    CreatePracticeComponent,
    PracticeComponent,
    PracticeDetailsComponent,
    CodePlaygroundComponent,
    MockInterviewComponent,
    CategoryPostsComponent
  ],
  providers: [
    DatePipe // Add DatePipe provider to fix date pipe issues
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA // Add this schema to fix unknown element errors
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
