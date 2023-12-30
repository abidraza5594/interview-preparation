import { Component } from '@angular/core';
import { PostsService } from '../../services/posts.service';
@Component({
  selector: 'app-recents-posts',
  templateUrl: './backend.component.html',
  styleUrl: './backend.component.css'
})
export class BackEndPostsComponent {
  backEndPostArray:Array<any>=[]
  constructor(private postService:PostsService){
  }
  ngOnInit(){
    this.postService.loadBackEndPost().subscribe(data=>{
      this.backEndPostArray=data  
    })
  }
}