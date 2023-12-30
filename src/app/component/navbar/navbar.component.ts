import { Component, HostListener, OnInit } from '@angular/core';
import { CategoryService } from '../../services/category.service';
import { PostsService } from '../../services/posts.service';
import { SharedScrollService } from '../../services/shared-scroll.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'] 
})
export class NavbarComponent implements OnInit {
  isCanvasMenuOpen = false;

  categoryArray: Array<any> = [];
  allPost:any
  constructor(
    private categoryService: CategoryService,
    private shereScrollService: SharedScrollService,
    private postService: PostsService,
    private router: Router,
  ) {}

  toggleCanvasMenu() {
    this.isCanvasMenuOpen = !this.isCanvasMenuOpen;
  }

  isSearchPopupOpen = false;
  toggleSearchPopup() {
    this.isSearchPopupOpen = !this.isSearchPopupOpen;
  }
  // close search on ESC button
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.isSearchPopupOpen) {
      this.toggleSearchPopup();
    }
  }

  scrollToTrending() {
    this.router.navigate(['/']); 
    setTimeout(()=>{
      this.shereScrollService.emitScrollEvent();
    })
  }
  scrollToLetest(){
    this.router.navigate(['/']); 
    setTimeout(()=>{
      this.shereScrollService.goToLetestSection();
    })
  }
  ngOnInit() {
    this.postService.loadLetestPosts().subscribe(val => {
      this.allPost = val;
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
}
