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
  loading: boolean = false;
  constructor(private postService: PostsService,
    private authService:AuthService,
    @Inject(PLATFORM_ID) private platformId: Object) {}
  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      AOS.init();
    }
    this.loading = true;
    this.postService.loadFrontEndPost().subscribe(
      data => {
        this.frontEndPostArray = data;
      },
      error => {
        console.error('Error loading front end posts:', error);
      },
      () => {
        this.loading = false;
      }
    );
  }

  handleLinkClick(frontend: any): void {
    this.authService.loginSweetAlert(frontend);    
  } 
}
