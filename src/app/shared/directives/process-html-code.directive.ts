import { AfterViewInit, Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import hljs from 'highlight.js/lib/core';

@Directive({
  selector: '[appProcessHtmlCode]',
  standalone: true
})
export class ProcessHtmlCodeDirective implements AfterViewInit, OnChanges {
  @Input() content: string | null = null;
  
  constructor(private el: ElementRef) {}
  
  ngAfterViewInit() {
    // Delay the initial processing to ensure content is fully rendered
    setTimeout(() => this.processCodeBlocks(), 300);
  }
  
  ngOnChanges(changes: SimpleChanges) {
    if (changes['content']) {
      // Use a longer timeout to ensure DOM is fully updated
      setTimeout(() => this.processCodeBlocks(), 300);
    }
  }
  
  private processCodeBlocks() {
    const element = this.el.nativeElement;
    
    if (!element) return;
    
    try {
      // Process all code blocks
      const codeElements = element.querySelectorAll('pre code');
      
      if (codeElements.length === 0) {
        console.warn('No code elements found for highlighting');
      }
      
      codeElements.forEach((codeElement: HTMLElement) => {
        try {
          // Try to determine language from class
          const classAttribute = codeElement.getAttribute('class') || '';
          const languageMatch = classAttribute.match(/language-(\w+)/);
          
          // Default to javascript if no language is specified
          if (!languageMatch && !classAttribute.includes('hljs')) {
            codeElement.classList.add('language-javascript');
          }
          
          if (languageMatch && languageMatch[1]) {
            // Set the language attribute for styling
            const lang = languageMatch[1];
            codeElement.parentElement?.setAttribute('data-language', lang);
          } else {
            // Default to JavaScript for styling
            codeElement.parentElement?.setAttribute('data-language', 'javascript');
          }
          
          // Check if content has JavaScript-like syntax
          const content = codeElement.textContent || '';
          if (!languageMatch && (
              content.includes('function') || 
              content.includes('let ') || 
              content.includes('const ') || 
              content.includes('var ') ||
              content.includes('console.log') ||
              (content.includes('{') && content.includes('}'))
          )) {
            codeElement.classList.add('language-javascript');
            codeElement.parentElement?.setAttribute('data-language', 'javascript');
          }
          
          // Apply highlighting
          if (!codeElement.classList.contains('hljs')) {
            hljs.highlightElement(codeElement);
          }
        } catch (e) {
          console.error('Error highlighting code block:', e);
        }
      });
      
      // Fix quill editor specific syntax blocks
      const qlSyntaxElements = element.querySelectorAll('.ql-syntax');
      qlSyntaxElements.forEach((syntaxElement: HTMLElement) => {
        try {
          // Create proper code blocks for Quill content
          const preElement = document.createElement('pre');
          const codeElement = document.createElement('code');
          
          // Copy content
          codeElement.textContent = syntaxElement.textContent;
          
          // Determine language based on content
          const content = syntaxElement.textContent || '';
          let language = 'plaintext';
          
          if (content.includes('function') || content.includes('let ') || content.includes('const ')) {
            language = 'javascript';
          } else if (content.includes('class') && content.includes('extends')) {
            language = 'typescript';
          }
          
          codeElement.classList.add(`language-${language}`);
          preElement.setAttribute('data-language', language);
          
          // Replace the element
          preElement.appendChild(codeElement);
          syntaxElement.parentNode?.replaceChild(preElement, syntaxElement);
          
          // Highlight the new element
          hljs.highlightElement(codeElement);
        } catch (e) {
          console.error('Error processing quill syntax block:', e);
        }
      });
      
      // Also look for plaintext code that might need processing
      const plainTextCodeElements = element.querySelectorAll('code:not(pre code):not(.hljs)');
      plainTextCodeElements.forEach((codeElement: HTMLElement) => {
        try {
          hljs.highlightElement(codeElement);
        } catch (e) {
          console.error('Error highlighting inline code:', e);
        }
      });
      
    } catch (e) {
      console.error('Error in process code blocks:', e);
    }
  }
} 