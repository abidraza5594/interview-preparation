import { Component, OnInit, ChangeDetectionStrategy, CUSTOM_ELEMENTS_SCHEMA, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PracticeService, PracticeQuestion } from '../../services/practice.service';
import { AuthService } from '../../services/auth.service';
import { ToastrModule, ToastrService } from 'ngx-toastr';
import { QuillModule } from 'ngx-quill';
import { GoogleAdComponent } from '../google-ad/google-ad.component';
import { CategoryService } from '../../services/category.service';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import java from 'highlight.js/lib/languages/java';
import python from 'highlight.js/lib/languages/python';
import csharp from 'highlight.js/lib/languages/csharp';
import cpp from 'highlight.js/lib/languages/cpp';
import 'highlight.js/styles/github.css';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HighlightCodeDirective } from '../../shared/directives/highlight-code.directive';
import { ProcessHtmlCodeDirective } from '../../shared/directives/process-html-code.directive';

@Component({
  selector: 'app-practice-details',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    QuillModule,
    ToastrModule,
    GoogleAdComponent,
    HighlightCodeDirective,
    ProcessHtmlCodeDirective
  ],
  providers: [ToastrService],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './practice-details.component.html',
  styleUrls: ['./practice-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PracticeDetailsComponent implements OnInit, AfterViewInit {
  @ViewChild('codeEditor') codeEditorRef!: ElementRef<HTMLTextAreaElement>;
  practiceQuestion: PracticeQuestion | null = null;
  sanitizedDescription: SafeHtml | null = null;
  sanitizedSolution: SafeHtml | null = null;
  loading = false;
  error: string | null = null;
  isSubmitting = false;
  isLiking = false;
  showSolution = false;
  showSparks = false;
  selectedOption: number | null = null;
  answerForm: FormGroup;
  codeForm: FormGroup;
  viewCountIncremented = false;
  userAnswer: string = '';
  isCorrect: boolean = false;
  isAnswered: boolean = false;
  isRunning: boolean = false;
  testResults: { input: string, expectedOutput: string, actualOutput: string, passed: boolean }[] = [];
  isLiked: boolean = false;
  isDisliked: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private practiceService: PracticeService,
    private authService: AuthService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef,
    private categoryService: CategoryService,
    private sanitizer: DomSanitizer
  ) {
    this.answerForm = this.fb.group({
      selectedOption: [null, Validators.required]
    });
    
    this.codeForm = this.fb.group({
      code: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    console.log('Initializing highlight.js with languages');
    
    // Register languages for code highlighting
    hljs.registerLanguage('javascript', javascript);
    hljs.registerLanguage('typescript', typescript);
    hljs.registerLanguage('java', java);
    hljs.registerLanguage('python', python);
    hljs.registerLanguage('csharp', csharp);
    hljs.registerLanguage('cpp', cpp);
    
    // Configure highlight.js options
    hljs.configure({
      ignoreUnescapedHTML: true,
      throwUnescapedHTML: false,
      languages: ['javascript', 'typescript', 'java', 'python', 'csharp', 'cpp']
    });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.loadPracticeQuestion(id);
      } else {
        this.error = 'Practice question ID not found';
        this.cdr.detectChanges();
      }
    });
  }

  ngAfterViewInit(): void {
    // Initialize code editor after view is initialized
    setTimeout(() => {
      this.applySyntaxHighlighting();
      this.initAccordion();
    }, 300);
  }

  loadPracticeQuestion(id: string): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    
    this.practiceService.getPracticeQuestionById(id).subscribe(
      (question) => {
        if (question) {
          // Load category information if available
          if (question.category) {
            this.categoryService.getCategoryById(question.category).subscribe(
              (category) => {
                if (category && category.name) {
                  question.categoryName = category.name;
                }
                this.finishLoadingQuestion(question, id);
              },
              (error) => {
                console.error('Error loading category:', error);
                // Continue with question loading even if category loading fails
                this.finishLoadingQuestion(question, id);
              }
            );
          } else {
            this.finishLoadingQuestion(question, id);
          }
        } else {
          this.error = 'Practice question not found';
          this.loading = false;
          this.cdr.detectChanges();
        }
      },
      (error) => {
        console.error('Error loading practice question:', error);
        this.error = 'Failed to load practice question';
        this.loading = false;
        this.cdr.detectChanges();
      }
    );
  }

  // Helper method to finish loading the question
  private finishLoadingQuestion(question: PracticeQuestion, id: string): void {
    this.practiceQuestion = question;
    
    // Sanitize and process the description and solution HTML
    if (question.description) {
      this.sanitizedDescription = this.sanitizer.bypassSecurityTrustHtml(question.description);
    }
    
    if (question.solution) {
      this.sanitizedSolution = this.sanitizer.bypassSecurityTrustHtml(question.solution);
    }
    
    this.loading = false;
    
    // Apply syntax highlighting to code blocks
    setTimeout(() => {
      this.applySyntaxHighlighting();
      this.initAccordion(); // Initialize the accordion
    }, 100);
    
    // Increment view count only once
    if (!this.viewCountIncremented) {
      this.practiceService.incrementViewCount(id).subscribe(() => {
        this.viewCountIncremented = true;
        console.log('View count incremented');
      });
    }
    
    // Initialize code form with template if it's a coding question
    if (question.questionType === 'coding' && question.codeTemplate) {
      this.codeForm.patchValue({ code: question.codeTemplate });
    }
    
    // Add structured data for SEO
    this.addStructuredData();
    
    // Update page title and meta tags for SEO
    this.updateMetaTags();
    
    this.cdr.detectChanges();
  }

  // Apply syntax highlighting to code blocks
  applySyntaxHighlighting(): void {
    console.log('Applying syntax highlighting');
    
    try {
      // Apply syntax highlighting to all code blocks
      document.querySelectorAll('pre code').forEach((el: Element) => {
        hljs.highlightElement(el as HTMLElement);
      });
      
      // Handle inline code elements
      document.querySelectorAll('code:not(pre code)').forEach((el: Element) => {
        hljs.highlightElement(el as HTMLElement);
      });
      
      // Apply to code editor if available
      if (this.codeEditorRef && this.codeEditorRef.nativeElement) {
        const codeElement = this.codeEditorRef.nativeElement;
        const language = this.practiceQuestion?.codeTemplate?.includes('function') ? 'javascript' : 'typescript';
        
        // Set appropriate language class
        codeElement.className = codeElement.className.replace(/language-\w+/g, '');
        codeElement.classList.add(`language-${language}`);
        
        console.log('Highlighting code editor with language:', language);
      }
      
      this.cdr.markForCheck();
    } catch (e) {
      console.error('Error applying syntax highlighting:', e);
    }
  }
  
  // Process and highlight code blocks in HTML content
  processCodeBlocksInHTML(element: HTMLElement): void {
    // This method is now handled by the ProcessHtmlCodeDirective
    // Keeping as a fallback
    if (!element) return;
    
    console.log('HTML content processed via directives');
  }

  selectOption(index: number): void {
    console.log('Option selected:', index);
    this.selectedOption = index;
    this.answerForm.patchValue({ selectedOption: index });
  }

  submitAnswer(): void {
    if (this.answerForm.invalid || this.isSubmitting || this.selectedOption === null || !this.practiceQuestion) {
      return;
    }
    
    this.isSubmitting = true;
    
    // Get the selected option
    const selectedOption = this.practiceQuestion.options?.[this.selectedOption];
    const isCorrect = selectedOption?.isCorrect === true;
    
    // Add a timeout to simulate server request
    setTimeout(() => {
      this.isCorrect = isCorrect;
      this.isAnswered = true;
      this.isSubmitting = false;
      
      // Record the attempt with the practice service
      if (this.practiceQuestion) {
        this.practiceService.recordAttempt(this.practiceQuestion.id!, isCorrect).subscribe();
      }
      
      // Show celebration animation for correct answers
      if (isCorrect) {
        this.showSparks = true;
        
        // Create confetti effect for correct answers
        this.celebrateCorrectAnswer();
        
        // Success notification
        this.toastr.success('Congratulations! Your answer is correct!');
      } else {
        this.toastr.error('That\'s not the correct answer. Try again!');
      }
      
      this.cdr.detectChanges();
    }, 1000);
  }
  
  // Function to create a celebratory effect for correct answers
  celebrateCorrectAnswer(): void {
    // Only proceed if we're in a browser environment with access to DOM
    if (typeof document === 'undefined') return;
    
    try {
      // Create confetti-like elements
      const celebrationContainer = document.querySelector('.celebration-container');
      if (celebrationContainer) {
        for (let i = 0; i < 30; i++) {
          const confetti = document.createElement('div');
          confetti.className = 'confetti';
          
          // Randomize properties
          const size = Math.random() * 10 + 5;
          const left = Math.random() * 100;
          const animationDelay = Math.random() * 2;
          const background = this.getRandomColor(i);
          
          // Set styles
          confetti.style.width = `${size}px`;
          confetti.style.height = `${size}px`;
          confetti.style.left = `${left}%`;
          confetti.style.animationDelay = `${animationDelay}s`;
          confetti.style.background = background;
          
          celebrationContainer.appendChild(confetti);
          
          // Remove after animation
          setTimeout(() => {
            if (confetti.parentNode) {
              confetti.parentNode.removeChild(confetti);
            }
          }, 3000);
        }
      }
    } catch (e) {
      console.error('Error creating celebration effect:', e);
    }
  }

  toggleSolution(): void {
    this.showSolution = !this.showSolution;
  }

  runCode(): void {
    if (this.codeForm.invalid || this.isRunning || !this.practiceQuestion) {
      return;
    }

    this.isRunning = true;
    const code = this.codeForm.value.code;
    this.cdr.detectChanges();
    
    // Attempt to evaluate the code with test cases
    setTimeout(() => {
      try {
        this.testResults = [];
        let allPassed = true;
        
        // Process test cases with actual evaluation
        if (this.practiceQuestion && this.practiceQuestion.testCases && this.practiceQuestion.testCases.length > 0) {
          for (const testCase of this.practiceQuestion.testCases) {
            try {
              // Create evaluation context - safely with Function constructor
              const inputValue = testCase.input.trim();
              const expectedOutput = testCase.expectedOutput.trim();
              
              // Build a sandboxed evaluation function
              // This is a simplified approach - in production, use a server-side sandbox
              let actualOutput;
              
              // Function to safely evaluate the code
              // Note: This is still not 100% secure for production use
              const evaluator = new Function('code', 'input', `
                try {
                  ${code}
                  // Assuming the function to test is named in the first line
                  const functionName = code.match(/function\\s+([\\w_$]+)\\s*\\(/)[1];
                  return eval(functionName + "(" + JSON.stringify(input) + ")");
                } catch (e) {
                  return "Error: " + e.message;
                }
              `);
              
              // Execute the code with input
              actualOutput = String(evaluator(code, inputValue));
              
              // Compare with expected output (trim whitespace for more forgiving comparison)
              const passed = actualOutput.trim() === expectedOutput;
              allPassed = allPassed && passed;
              
              if (!testCase.isHidden || !passed) {
                this.testResults.push({
                  input: inputValue,
                  expectedOutput: expectedOutput,
                  actualOutput: actualOutput,
                  passed
                });
              }
            } catch (e: any) {
              console.error('Error evaluating test case:', e);
              this.testResults.push({
                input: testCase.input,
                expectedOutput: testCase.expectedOutput,
                actualOutput: `Error: ${e.message}`,
                passed: false
              });
              allPassed = false;
            }
          }
        } else {
          // No test cases, consider it passed
          allPassed = true;
        }
        
        // Record the attempt
        if (this.practiceQuestion) {
          this.practiceService.recordAttempt(this.practiceQuestion.id!, allPassed).subscribe();
        }
        
        this.isCorrect = allPassed;
        this.isAnswered = true;
        this.isRunning = false;
        
        if (allPassed) {
          this.celebrateCorrectAnswer();
          this.toastr.success('All test cases passed! Great job!');
        } else {
          this.toastr.error('Some test cases failed. Try again!');
        }
      } catch (e: any) {
        console.error('Error in code evaluation:', e);
        this.isRunning = false;
        this.toastr.error('Error evaluating your code. Please check syntax.');
      }
      
      this.cdr.detectChanges();
    }, 500);
  }
  
  resetCode(): void {
    if (this.practiceQuestion && this.practiceQuestion.codeTemplate) {
      this.codeForm.patchValue({ code: this.practiceQuestion.codeTemplate });
      this.testResults = [];
      this.isAnswered = false;
      this.isCorrect = false;
      this.cdr.detectChanges();
    }
  }

  resetAnswer(): void {
    this.isAnswered = false;
    this.isCorrect = false;
    this.selectedOption = null;
    this.answerForm.reset();
    this.testResults = [];
  }

  goBack(): void {
    this.router.navigate(['/practice']);
  }

  // Toggle like/dislike a question
  toggleLike(isLike: boolean): void {
    if (!this.practiceQuestion?.id || this.isLiking) return;
    
    this.isLiking = true;
    
    // Update UI immediately for better user experience
    if (isLike) {
      this.isLiked = true;
      this.isDisliked = false;
    } else {
      this.isLiked = false;
      this.isDisliked = true;
    }
    
    this.practiceService.likePracticeQuestion(this.practiceQuestion.id, isLike)
      .subscribe(
        () => {
          if (this.practiceQuestion) {
            // Update the like count in UI
            this.practiceQuestion.likes = (this.practiceQuestion.likes || 0) + (isLike ? 1 : -1);
          }
          this.isLiking = false;
          this.cdr.detectChanges();
        },
        (error) => {
          console.error('Error ' + (isLike ? 'liking' : 'disliking') + ' question:', error);
          this.toastr.error('Failed to ' + (isLike ? 'like' : 'dislike') + ' the question');
          this.isLiking = false;
          this.cdr.detectChanges();
        }
      );
  }

  // Add structured data for SEO
  addStructuredData(): void {
    if (!this.practiceQuestion) return;

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'LearningResource',
      'name': this.practiceQuestion.title,
      'description': this.stripHtml(this.practiceQuestion.description),
      'educationalLevel': 'beginner',
      'keywords': this.practiceQuestion.tags?.join(', '),
      'datePublished': new Date().toISOString(),
      'author': {
        '@type': 'Organization',
        'name': 'Interview Preparation',
        'url': 'https://www.yourwebsite.com'
      },
      'provider': {
        '@type': 'Organization',
        'name': 'Interview Preparation',
        'url': 'https://www.yourwebsite.com'
      }
    };

    // Add the structured data to the page
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(structuredData);
    document.head.appendChild(script);
  }

  // Helper method to strip HTML tags for structured data
  stripHtml(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  // Update meta tags for SEO
  updateMetaTags(): void {
    if (!this.practiceQuestion) return;
    
    // Update page title
    document.title = `${this.practiceQuestion.title} | Interview Preparation`;
    
    // Find or create meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    
    // Set meta description content
    const description = this.stripHtml(this.practiceQuestion.description).substring(0, 160);
    metaDescription.setAttribute('content', description);
    
    // Update keywords meta tag
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    
    // Combine question tags with common keywords
    const keywordsList = [
      ...(this.practiceQuestion.tags || []),
      'interview preparation',
      'coding interview',
      'programming questions',
      this.practiceQuestion.difficulty,
      this.practiceQuestion.questionType === 'multiple-choice' ? 'multiple choice' : 'coding challenge'
    ];
    
    metaKeywords.setAttribute('content', keywordsList.join(', '));
  }

  // Format success rate to show only 2 decimal places
  formatSuccessRate(rate: number): string {
    if (rate === undefined || rate === null) return '0.00';
    return rate.toFixed(2);
  }

  // Get random color for confetti
  getRandomColor(index: number): string {
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
    return colors[index % colors.length];
  }

  // Helper function to initialize the accordion for hints
  initAccordion(): void {
    setTimeout(() => {
      const accordionElements = document.querySelectorAll('.accordion-collapse');
      if (accordionElements.length > 0) {
        // For Bootstrap 5 - add event listeners if using vanilla JS
        document.querySelectorAll('.accordion-button').forEach(button => {
          button.addEventListener('click', () => {
            const target = button.getAttribute('data-bs-target');
            if (target) {
              const collapse = document.querySelector(target) as HTMLElement;
              if (collapse) {
                if (collapse.classList.contains('show')) {
                  collapse.classList.remove('show');
                  button.classList.add('collapsed');
                  button.setAttribute('aria-expanded', 'false');
                } else {
                  // Close other opened items
                  document.querySelectorAll('.accordion-collapse.show').forEach(item => {
                    if (item !== collapse) {
                      item.classList.remove('show');
                      const otherButton = document.querySelector(`[data-bs-target="#${item.id}"]`);
                      if (otherButton) {
                        otherButton.classList.add('collapsed');
                        otherButton.setAttribute('aria-expanded', 'false');
                      }
                    }
                  });
                  
                  collapse.classList.add('show');
                  button.classList.remove('collapsed');
                  button.setAttribute('aria-expanded', 'true');
                }
              }
            }
          });
        });
        
        console.log('Accordion initialized');
      }
    }, 300);
  }
}
