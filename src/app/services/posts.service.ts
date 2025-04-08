import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PostsService {

  constructor(private afs:AngularFirestore) { }

  loadFeaturedData(){
    return this.afs.collection("posts", ref => 
      ref.orderBy('createdAt', 'desc')
    ).snapshotChanges().pipe(
      map(actions => {
        const allPosts = actions.map(a => {
          const data = a.payload.doc.data() as any;
          const id = a.payload.doc.id;
          return {id, data}
        });
        
        return allPosts
          .filter(post => post.data.isFeatured === true)
          .slice(0, 3);
      })
    )
  }

  loadLetestPosts(){
    return this.afs.collection("posts", ref => ref.orderBy('createdAt', 'desc')).snapshotChanges().pipe(
      map(actions => {
        return actions.map(a => {
          const data = a.payload.doc.data();
          const id = a.payload.doc.id;
          return {id, data}
        })
      })
    )
  }

  loadCategoryPost(categoryId:any){
    return this.afs.collection("posts",ref=>ref.where('category.CategoryId','==',categoryId).limit(4)).snapshotChanges().pipe(
      map(actions =>{
        return actions.map(a=>{
          const data = a.payload.doc.data();
          const id = a.payload.doc.id;
          return {id,data}
        })
      })
    )
  }

  loadFrontEndPost(){
    return this.afs.collection("posts", ref => 
      ref.orderBy('createdAt', 'desc')
    ).snapshotChanges().pipe(
      map(actions => {
        const allPosts = actions.map(a => {
          const data = a.payload.doc.data() as any;
          const id = a.payload.doc.id;
          return {id, data}
        });
        
        return allPosts.filter(post => 
          post.data.postType === 'frontend' || 
          post.data.postType === 'animation' || 
          post.data.postType === 'feature'
        );
      })
    )
  }

  loadBackEndPost(){
    return this.afs.collection("posts", ref => 
      ref.orderBy('createdAt', 'desc')
    ).snapshotChanges().pipe(
      map(actions => {
        const allPosts = actions.map(a => {
          const data = a.payload.doc.data() as any;
          const id = a.payload.doc.id;
          return {id, data}
        });
        
        return allPosts
          .filter(post => post.data.postType === 'backend')
          .slice(0, 3);
      })
    )
  }

  loadNormalHeaderPost() {
    return this.afs.collection("posts", ref =>
      ref.orderBy('createdAt', 'desc')
    ).snapshotChanges().pipe(
      map(actions => {
        const allPosts = actions.map(a => {
          const data = a.payload.doc.data() as any;
          const id = a.payload.doc.id;
          return { id, data };
        });
        
        return allPosts
          .filter(post => post.data.postType === 'post' && post.data.isFeatured === true)
          .slice(0, 3);
      })
    );
  }
  

  loadOnePost(id:any){
    return this.afs.doc(`posts/${id}`).snapshotChanges().pipe(
      map(action => {
        if (!action.payload.exists) {
          console.warn(`Post with ID ${id} not found`);
          return null;
        }
        const data = action.payload.data() as any;
        const docId = action.payload.id;
        return { id: docId, ...data };
      })
    );
  }

  loadAnimatedPosts() {
    return this.afs.collection("posts", ref => 
      ref.orderBy('createdAt', 'desc')
    ).snapshotChanges().pipe(
      map(actions => {
        const allPosts = actions.map(a => {
          const data = a.payload.doc.data() as any;
          const id = a.payload.doc.id;
          return {id, data}
        });
        
        return allPosts
          .filter(post => post.data.postType === 'animation')
          .slice(0, 3);
      })
    )
  }

}
