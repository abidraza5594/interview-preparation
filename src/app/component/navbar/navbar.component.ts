import { Component, HostListener, OnInit } from '@angular/core';
import { PostsService } from '../../services/posts.service';
import { SharedScrollService } from '../../services/shared-scroll.service';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { CategoryService } from '../../services/category.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {
  isCanvasMenuOpen = false;
  isSearchPopupOpen = false;

  allPost: any[] = [];
  searchControl = new FormControl();
  filteredOptions!: Observable<string[]>;
  categoryArray: any[] = [];

  constructor(
    private postService: PostsService,
    private shereScrollService: SharedScrollService,
    private categoryService: CategoryService,
    private authService:AuthService,
    private router: Router,
  ) {}
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.isSearchPopupOpen) {
      this.toggleSearchPopup();
    }
  }
  toggleCanvasMenu() {
    this.isCanvasMenuOpen = !this.isCanvasMenuOpen;
  }
  toggleSearchPopup() {
    this.isSearchPopupOpen = !this.isSearchPopupOpen;
  }
  scrollToFeature() {
    this.router.navigate(['/']);
    setTimeout(() => {
      this.shereScrollService.emitScrollEvent();
    });
  }
  scrollToLetest() {
    this.router.navigate(['/']);
    setTimeout(() => {
      this.shereScrollService.goToLetestSection();
    });
  }
  sendEmail() {
    window.location.href = 'mailto:abidraza8104@gmail.com.com?subject=Subject&body=Unlock interview success! Dive into expert-curated coding questions. Elevate your skills with Interview Preparation. Explore now: https://interviewpreparation.netlify.app/.';
  }
  sendWhatsAppMessage() {
    const recipientNumber = '+918104184175';
    const message = 'Hello, this is a WhatsApp message from my Angular app!';

    const whatsappLink = this.shereScrollService.generateWhatsAppLink(recipientNumber, message);
    window.location.href = whatsappLink;
  }
  ngOnInit() {
    this.postService.loadLetestPosts().subscribe(val => {
      this.allPost = val;
      this.filteredOptions = this.searchControl.valueChanges.pipe(
        startWith(''),
        map(value => this._filter(value))
      );
    });
    this.categoryService.loadData().subscribe(val=>{
      let cat=[]
      for(let p of this.allPost){
        let postcatID=p.id
        let postcat=p.data.category.Category
        for(let c of val){
          let catobj=((c.data as any).category)
          if(postcat===catobj){
            let catOBJ={catname:catobj,catID:postcatID,permalink:p.data.permalink}
            cat.push(catOBJ)
          }
        }
      }
      this.categoryArray=cat
    })
  }
  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    return this.allPost
      .filter(post => post.data.title.toLowerCase().includes(filterValue))
      .map(post => post.data.title);
  }
  onSubmit() {
    const selectedPost = this.allPost.find(
      (post) => post.data.title.toLowerCase() === this.searchControl.value.toLowerCase()
    );
    if (selectedPost) {
      const permalink = selectedPost.data.permalink;
      if (permalink) {
        const postId = selectedPost.id;
        const frontend = { permalink, id: postId, data: selectedPost.data };
        this.authService.loginSweetAlert(frontend);
        this.toggleSearchPopup();
      } else {
        console.error('Permalink not found for selected post:', selectedPost);
      }
    } else {
      console.error('Selected post not found:', this.searchControl.value);
    }
  }
}
