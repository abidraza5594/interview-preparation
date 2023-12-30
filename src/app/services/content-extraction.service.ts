import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ContentExtractionService {

  extractQuestions(content: string): string[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const questions = Array.from(doc.querySelectorAll('h3')).map((h3: HTMLElement) => h3.innerText.trim());
    return questions;
  }

}
