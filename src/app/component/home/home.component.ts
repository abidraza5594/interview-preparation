import { Component, ElementRef, Inject, PLATFORM_ID } from '@angular/core';
import { PostsService } from '../../services/posts.service';
import { SharedScrollService } from '../../services/shared-scroll.service';
import { trigger, state, style, transition, animate } from '@angular/animations';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../services/auth.service';
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
      })),
      transition('in => out', animate('200ms ease-out')),
      transition('out => in', animate('200ms ease-in'))
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
  constructor(
    private el: ElementRef,
    private postService: PostsService,
    private sharedScrollService: SharedScrollService,  
    private authService:AuthService,  
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}
  activeTab: string = 'frontend';
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }
  ngOnInit() {
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
}