import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ContentExtractionService {

  extractQuestions(content: string): { text: string; id: string }[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const questionsWithIds = Array.from(doc.querySelectorAll('h3')).map((h3: HTMLElement, index: number) => {
      const questionText = h3.innerText.trim();
      const questionId = `question_${index + 1}`; // You can customize the ID format as needed
      h3.id = questionId; // Set the ID to the h3 element
      return { text: questionText, id: questionId };
    });
  
    return questionsWithIds;
  }
  

}
