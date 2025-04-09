import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';

import { routes } from './app.routes';
import { monacoConfig } from './monaco-config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    MonacoEditorModule.forRoot(monacoConfig)
  ]
}; 