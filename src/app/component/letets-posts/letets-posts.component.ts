import { Component, ElementRef, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { PostsService } from '../../services/posts.service';
import { SharedScrollService } from '../../services/shared-scroll.service';
import { isPlatformBrowser } from '@angular/common';
import Aos from 'aos';
import { AuthService } from '../../services/auth.service';
@Component({
  selector: 'app-letets-posts',
  templateUrl: './letets-posts.component.html',
  styleUrls: ['./letets-posts.component.css']
})
export class LetetsPostsComponent implements OnInit {
  letestArray: Array<any> = [];
  constructor(
    private postService: PostsService,
    private el: ElementRef,
    private sharedScrollService: SharedScrollService,
    private authService:AuthService,
    @Inject(PLATFORM_ID) private platformId: Object 
  ) { }
  socialIconsData = [
    { id: 1, name: 'Facebook', iconClass: 'fab fa-facebook-f' },
    { id: 2, name: 'Twitter', iconClass: 'fab fa-twitter' },
    { id: 3, name: 'LinkedIn', iconClass: 'fab fa-linkedin-in' },
  ];
  isSocialIconsVisible: any = {};
  toggleSocialIcons(id: number) {
    this.isSocialIconsVisible[id] = !this.isSocialIconsVisible[id];
  }
  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      Aos.init();
    }
    this.postService.loadLetestPosts().subscribe((val) => {
      this.letestArray = val;
    });
    this.sharedScrollService.scrollLetestSection.subscribe(() => {
      setTimeout(() => {
        this.scrollToLatest();
      });
    });
  }
  scrollToLatest() {
    const LetestPosts = this.el.nativeElement.querySelector('#LetestPosts');
    if (LetestPosts) {
      LetestPosts.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  shareOnFacebook(post: any) {
    const baseUrl = window.location.origin + window.location.pathname;
    const title = encodeURIComponent(post.data.title);
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(baseUrl)}&title=${title}`;
    this.openShareWindow(shareUrl);
  }
  shareOnTwitter(post: any) {
    const shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(
      window.location.href
    )}&text=${encodeURIComponent(post.data.title)}`;
    this.openShareWindow(shareUrl);
  }
  shareOnLinkedIn(post: any) {
    const shareUrl = `https://www.linkedin.com/shareArticle?url=${encodeURIComponent(
      window.location.href
    )}&title=${encodeURIComponent(post.data.title)}`;
    this.openShareWindow(shareUrl);
  }
  shareOnWhatsApp(post: any) {
    const shareUrl = `whatsapp://send?text=${encodeURIComponent(post.data.title + ' ' + window.location.href)}`;
    this.openShareWindow(shareUrl);
  }
  openShareWindow(url: string) {
    window.open(url, '_blank', 'width=600,height=400');
  }
  handleLinkClick(frontend: any): void {
    this.authService.loginSweetAlert(frontend);    
  } 
}