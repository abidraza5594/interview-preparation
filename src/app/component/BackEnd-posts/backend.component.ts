import { Component, OnInit } from '@angular/core';
import { PostsService } from '../../services/posts.service';

@Component({
  selector: 'app-recents-posts',
  templateUrl: './backend.component.html',
  styleUrl: './backend.component.css'
})
export class BackEndPostsComponent implements OnInit {
  backEndPostArray: Array<any> = [];
  displayedPosts: Array<any> = [];
  currentPage: number = 1;
  postsPerPage: number = 3;
  hasMorePosts: boolean = true;

  constructor(private postService: PostsService) {}

  ngOnInit() {
    this.postService.loadBackEndPost().subscribe(data => {
      this.backEndPostArray = data;
      this.updateDisplayedPosts();
    });
  }

  updateDisplayedPosts() {
    const startIndex = 0;
    const endIndex = this.currentPage * this.postsPerPage;
    this.displayedPosts = this.backEndPostArray.slice(startIndex, endIndex);
    this.hasMorePosts = endIndex < this.backEndPostArray.length;
  }

  loadMore() {
    if (this.hasMorePosts) {
      this.currentPage++;
      this.updateDisplayedPosts();
    }
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