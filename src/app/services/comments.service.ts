import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { ToastrService } from 'ngx-toastr';
import { map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CommentsService {

  constructor(private afs:AngularFirestore,
    private toaster:ToastrService,) { }

  saveCommentData(commentData:any){
    this.afs.collection("comment").add(commentData).then(docRef=>{
      this.toaster.success("Comment Insert Successfully")     
    })
  }


  loadComment(postID:any){  
    return this.afs.collection("comment",ref=>ref.where('commentCategoryId','==',postID)).snapshotChanges().pipe( 
      map(actions =>{
        return actions.map(a=>{
          const data = a.payload.doc.data();
          const id = a.payload.doc.id;  
          return {id,data}  
        })
      })
    )
  }


  saveContactUS(commentData:any){
    this.afs.collection("contactUs").add(commentData).then(docRef=>{
      this.toaster.success("We Received Your Message Successfully");    
    })
  }

}
