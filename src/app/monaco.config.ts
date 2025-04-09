import { NgxMonacoEditorConfig } from 'ngx-monaco-editor-v2';

export const monacoConfig: NgxMonacoEditorConfig = {
  baseUrl: 'assets/monaco',
  defaultOptions: { scrollBeyondLastLine: false },
  onMonacoLoad: () => {
    console.log('Monaco Editor loaded');
  }
}; 