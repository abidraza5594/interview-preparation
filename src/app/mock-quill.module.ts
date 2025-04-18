import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

@NgModule({
  declarations: [],
  imports: [
    CommonModule
  ],
  exports: []
})
export class QuillModule {
  static forRoot(config?: any): any {
    return {
      ngModule: QuillModule,
      providers: []
    };
  }
}
