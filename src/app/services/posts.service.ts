import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PostsService {

  constructor(private afs:AngularFirestore) { }

  loadFeaturedData(){
    return this.afs.collection("posts",ref=>ref.where('isFeatured','==',true).limit(4)).snapshotChanges().pipe(
      map(actions =>{
        return actions.map(a=>{
          const data = a.payload.doc.data();
          const id = a.payload.doc.id;
          return {id,data}
        })
      })
    )
  }

  loadLetestPosts(){
    return this.afs.collection("posts",ref=>ref.orderBy('createdAt')).snapshotChanges().pipe(
      map(actions =>{
        return actions.map(a=>{
          const data = a.payload.doc.data();
          const id = a.payload.doc.id;
          return {id,data}
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
    return this.afs.collection("posts",ref=>ref.where('postType','==',"frontend")).snapshotChanges().pipe(
      map(actions =>{
        return actions.map(a=>{
          const data = a.payload.doc.data();
          const id = a.payload.doc.id;
          return {id,data}
        })
      })
    )
  }

  loadBackEndPost(){
    return this.afs.collection("posts",ref=>ref.where('postType','==',"backend")).snapshotChanges().pipe(
      map(actions =>{
        return actions.map(a=>{
          const data = a.payload.doc.data();
          const id = a.payload.doc.id;
          return {id,data}
        })
      })
    )
  }

  loadNormalHeaderPost() {
    return this.afs.collection("posts", ref =>
      ref.where('postType', '==', 'post').where('isFeatured', '==', true)
    ).snapshotChanges().pipe(
      map(actions => {
        return actions.map(a => {
          const data = a.payload.doc.data();
          const id = a.payload.doc.id;
          return { id, data };
        });
      })
    );
  }
  

  loadOnePost(id:any){
    return this.afs.doc(`posts/${id}`).valueChanges()
  }

}
