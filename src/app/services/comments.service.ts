import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { ToastrService } from 'ngx-toastr';
import { map, combineLatest } from 'rxjs';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})
export class CommentsService {

  constructor(private afs:AngularFirestore,
    private toaster:ToastrService) { }

  saveCommentData(commentData:any){
    // First add the comment
    this.afs.collection("comment").add(commentData).then(docRef => {
      // Then update the post's comment count
      const postId = commentData.commentCategoryId;
      if (postId) {
        const postRef = this.afs.doc(`posts/${postId}`);
        
        // Use FieldValue.increment to safely increment the counter
        postRef.update({
          comments: firebase.firestore.FieldValue.increment(1)
        }).then(() => {
          this.toaster.success("Comment posted successfully");
        }).catch(error => {
          console.error("Error updating post comment count:", error);
          // Still show success for the comment since it was added
          this.toaster.success("Comment posted successfully");
        });
      } else {
        this.toaster.success("Comment posted successfully");
      }
    }).catch(error => {
      console.error("Error adding comment:", error);
      this.toaster.error("Failed to post comment. Please try again.");
    });
  }

  loadComment(postID:any){  
    // Get comments from both the global comments collection and the post's comments subcollection
    // First, get comments from the main collection
    const mainComments$ = this.afs.collection("comment", ref => 
      ref.where('commentCategoryId', '==', postID)
    ).snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data();
        const id = a.payload.doc.id;
        return {id, data}
      }))
    );
    
    // Second, get comments from the post's subcollection
    const postComments$ = this.afs.collection(`posts/${postID}/comments`).snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data();
        const id = a.payload.doc.id;
        return {id, data}
      }))
    );
    
    // Combine both observables
    return combineLatest([mainComments$, postComments$]).pipe(
      map(([comments1, comments2]) => {
        console.log('Main comments:', comments1);
        console.log('Post comments:', comments2);
        // Return combined array of comments
        return [...comments1, ...comments2];
      })
    );
  }

  saveContactUS(commentData:any){
    this.afs.collection("contactUs").add(commentData).then(docRef=>{
      this.toaster.success("We Received Your Message Successfully");    
    })
  }
}
