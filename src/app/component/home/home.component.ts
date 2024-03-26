import { Component, ElementRef, Inject, PLATFORM_ID } from '@angular/core';
import { PostsService } from '../../services/posts.service';
import { SharedScrollService } from '../../services/shared-scroll.service';
import { trigger, state, style, transition, animate, group } from '@angular/animations';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { ToastrService } from 'ngx-toastr';
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  animations: [
    trigger('slideInOut', [
      state('in', style({
        transform: 'translateX(0)',
        opacity: 1
      })),
      state('out', style({
        transform: 'translateX(-100%)',
        opacity: 0
      })), // function is used to specify how the animation should behave when transitioning from one state to another.
      transition('in => out', animate('200ms ease-out')), // When transitioning from the 'in' state to the 'out' state.
      transition('out => in', animate('200ms ease-in')) // When transitioning from the 'out' state to the 'in' state.
    ])
  ]
})
export class HomeComponent{
  featuredArray: Array<any> = [];
  normalHeaderPostArray: Array<any> = [];
  bigFeaturePost: any;
  currentIndex = 0;
  displayedPosts: any[] = [];
  animationState = 'in'; 
  newsLetterForm: any;
  constructor(
    private el: ElementRef,
    private postService: PostsService,
    private sharedScrollService: SharedScrollService,  
    private authService:AuthService,
    private fb: FormBuilder,
    private afs:AngularFirestore,
    private toaster:ToastrService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}
  activeTab: string = 'frontend';
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }
  ngOnInit() {
    this.newsLetterForm = this.fb.group({
      newsLetterEmail: ['', Validators.required],
    });
    if (isPlatformBrowser(this.platformId)) {
      AOS.init();
    }
    this.postService.loadNormalHeaderPost().subscribe(val => {
      this.normalHeaderPostArray = val;
      if (this.normalHeaderPostArray.length > 0) {
        this.displayedPosts.push(this.normalHeaderPostArray[this.currentIndex]);
        this.scheduleNextPost();
      }
    });
    this.sharedScrollService.scrollToFeature.subscribe(() => {
      this.scrollToFeature();
    });
    this.sharedScrollService.scrollLetestSection.subscribe(() => {
      setTimeout(() => {
        this.scrollToTrending();
      });
    });
    this.postService.loadFeaturedData().subscribe((val) => {
      this.bigFeaturePost = val[val.length - 1];
      this.featuredArray = val.filter((data: any) => data !== this.bigFeaturePost);
    });
  }
  scheduleNextPost() {
    setTimeout(() => {
      this.animationState = 'out'; 
      setTimeout(() => {
        this.currentIndex = (this.currentIndex + 1) % this.normalHeaderPostArray.length;
        this.displayedPosts = [this.normalHeaderPostArray[this.currentIndex]];
        this.animationState = 'in'; 
        this.scheduleNextPost();
      }, 200); 
    }, 4000);
  }
  scrollToTrending() {
    const trendingSection = this.el.nativeElement.querySelector('#trendingSection');
    if (trendingSection) {
      trendingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  handleLinkClick(frontend: any): void {
    this.authService.loginSweetAlert(frontend);    
  } 
  scrollToFeature() {
    const LetestPosts = this.el.nativeElement.querySelector('#FeaturePosts');
    if (LetestPosts) {
      LetestPosts.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  sendEmail() {
    window.location.href = 'mailto:abidraza8104@gmail.com.com?subject=Subject&body=Unlock interview success! Dive into expert-curated coding questions. Elevate your skills with Interview Preparation. Explore now: https://interviewpreparation.netlify.app/.';
  }
  sendWhatsAppMessage() {
    const recipientNumber = '+918104184175';
    const message = 'Hello, this is a WhatsApp message from my Angular app!';

    const whatsappLink = this.sharedScrollService.generateWhatsAppLink(recipientNumber, message);
    window.location.href = whatsappLink;
  }

  newsLetterEmailHandler() {
    this.newsLetterForm.markAllAsTouched();
    if (this.newsLetterForm.valid) {
      const email = this.newsLetterForm.value.newsLetterEmail;  
      this.afs.collection("newsLetterEmails").add({ email: email }).then(docRef => {
        this.toaster.success("Email Insert Successfully");
      }).catch(error => {
        console.error('Error adding document: ', error);
      });
      this.newsLetterForm.reset()
    }
  }
  
}