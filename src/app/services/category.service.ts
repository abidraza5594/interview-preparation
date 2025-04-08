import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, map } from 'rxjs';

export interface Category {
  id: string;
  name?: string;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {

  constructor(private firestore: AngularFirestore) { }

  // Get all categories
  getCategories(): Observable<Category[]> {
    return this.firestore.collection('categories')
      .snapshotChanges()
      .pipe(
        map(actions => actions.map(a => {
          const data = a.payload.doc.data() as any;
          const id = a.payload.doc.id;
          // Handle both formats - new format with direct category string and old format with Category object
          const categoryName = data.category?.Category || 
                               (typeof data.category === 'string' ? data.category : null) || 
                               data.name;
          return { id, data, name: categoryName };
        }))
      );
  }

  // Load data method for navbar component
  loadData(): Observable<any[]> {
    return this.firestore.collection('categories')
      .snapshotChanges()
      .pipe(
        map(actions => actions.map(a => {
          const data = a.payload.doc.data() as any;
          const id = a.payload.doc.id;
          return { id, ...data };
        }))
      );
  }

  // Get a single category by ID
  getCategoryById(id: string): Observable<Category | null> {
    return this.firestore.doc<any>(`categories/${id}`)
      .snapshotChanges()
      .pipe(
        map(action => {
          if (action.payload.exists) {
            const data = action.payload.data();
            // Handle both formats - new format with direct category string and old format with Category object
            const categoryName = data.category?.Category || 
                                (typeof data.category === 'string' ? data.category : null) || 
                                data.name;
            return { 
              id: action.payload.id, 
              data,
              name: categoryName 
            };
          } else {
            return null;
          }
        })
      );
  }

  // Create a new category
  createCategory(categoryData: { name: string, description?: string }): Promise<string> {
    return this.firestore.collection('categories').add({
      category: {
        Category: categoryData.name,
        Description: categoryData.description || ''
      },
      createdAt: new Date()
    }).then(docRef => docRef.id);
  }

  // Update a category
  updateCategory(id: string, categoryData: { name?: string, description?: string }): Promise<void> {
    const updateData: any = {};
    
    if (categoryData.name) {
      updateData['category.Category'] = categoryData.name;
    }
    
    if (categoryData.description !== undefined) {
      updateData['category.Description'] = categoryData.description;
    }
    
    return this.firestore.collection('categories').doc(id).update(updateData);
  }

  // Delete a category
  deleteCategory(id: string): Promise<void> {
    return this.firestore.collection('categories').doc(id).delete();
  }
}
