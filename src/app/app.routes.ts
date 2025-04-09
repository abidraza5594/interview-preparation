import { Routes } from '@angular/router';
import { CodePlaygroundComponent } from './component/code-playground/code-playground.component';

export const routes: Routes = [
  {
    path: 'playground',
    component: CodePlaygroundComponent,
    title: 'Code Playground'
  },
]; 