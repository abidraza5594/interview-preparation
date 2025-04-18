import { NgxMonacoEditorConfig } from 'ngx-monaco-editor-v2';

export const monacoConfig: NgxMonacoEditorConfig = {
  baseUrl: 'assets/monaco',
  defaultOptions: {
    scrollBeyondLastLine: false,
    minimap: { enabled: false },
    theme: 'vs-dark',
    automaticLayout: true,
    fontSize: 14
  },
  onMonacoLoad: () => {
    console.log('Monaco Editor loaded');
    // Make monaco available globally
    if (typeof window !== 'undefined' && window.monaco) {
      (window as any).monaco = window.monaco;
    }
  }
};
