import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { PostsService } from '../../services/posts.service';
import AOS from 'aos';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-populars-posts',
  templateUrl: './frontend.component.html',
  styleUrls: ['./frontend.component.css']
})
export class FrontEndComponent implements OnInit {
  frontEndPostArray: Array<any> = [];
  displayedPosts: Array<any> = [];
  loading: boolean = false;
  currentPage: number = 1;
  postsPerPage: number = 3;
  hasMorePosts: boolean = true;

  constructor(
    private postService: PostsService,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      AOS.init();
    }
    this.loading = true;
    this.postService.loadFrontEndPost().subscribe(
      data => {
        this.frontEndPostArray = data;
        this.updateDisplayedPosts();
      },
      error => {
        console.error('Error loading front end posts:', error);
      },
      () => {
        this.loading = false;
      }
    );
  }

  updateDisplayedPosts() {
    const startIndex = 0;
    const endIndex = this.currentPage * this.postsPerPage;
    this.displayedPosts = this.frontEndPostArray.slice(startIndex, endIndex);
    this.hasMorePosts = endIndex < this.frontEndPostArray.length;
  }

  loadMore() {
    if (this.hasMorePosts) {
      this.currentPage++;
      this.updateDisplayedPosts();
    }
  }

  handleLinkClick(frontend: any): void {
    this.authService.loginSweetAlert(frontend);    
  }
  
  // Helper method to create a permalink from a title
  createPermalink(title: string): string {
    if (!title) return '';
    
    // Convert to lowercase, replace spaces with hyphens, and remove special characters
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Replace multiple hyphens with a single hyphen
      .trim();                  // Trim leading/trailing spaces
  }
}
