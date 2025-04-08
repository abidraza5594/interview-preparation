import { AfterViewInit, Directive, ElementRef, Input, OnChanges, Renderer2, SimpleChanges } from '@angular/core';
import hljs from 'highlight.js/lib/core';

@Directive({
  selector: '[appHighlightCode]',
  standalone: true
})
export class HighlightCodeDirective implements AfterViewInit, OnChanges {
  @Input() language: string | undefined;
  
  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngAfterViewInit() {
    this.highlightElement();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['language']) {
      this.highlightElement();
    }
  }

  private highlightElement() {
    const codeElement = this.el.nativeElement;
    
    // Set language attribute for styling
    if (this.language) {
      this.renderer.setAttribute(codeElement.parentNode, 'data-language', this.language);
    }

    try {
      hljs.highlightElement(codeElement);
    } catch (e) {
      console.error('Error highlighting code:', e);
    }
  }
} 