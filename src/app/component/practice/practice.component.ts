import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrModule, ToastrService } from 'ngx-toastr';
import { Observable, of, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { PracticeService, PracticeQuestion } from '../../services/practice.service';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CategoryService, Category } from '../../services/category.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import { HighlightCodeDirective } from '../../shared/directives/highlight-code.directive';
import { ProcessHtmlCodeDirective } from '../../shared/directives/process-html-code.directive';

@Component({
  selector: 'app-practice',
  templateUrl: './practice.component.html',
  styleUrls: ['./practice.component.css'],
  imports: [
    CommonModule, 
    FormsModule, 
    ToastrModule, 
    HighlightCodeDirective,
    ProcessHtmlCodeDirective
  ],
  providers: [ToastrService],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PracticeComponent implements OnInit {
  practiceQuestions$: Observable<PracticeQuestion[]>;
  filteredQuestions$: Observable<PracticeQuestion[]>;
  categories: string[] = [];
  difficulties: string[] = ['easy', 'medium', 'hard'];
  questionTypes: string[] = ['multiple-choice', 'coding'];
  categoryMap: Map<string, string> = new Map(); // Map to store category ID to name mapping
  
  // Added for description processing
  processedDescriptions: Map<string, SafeHtml> = new Map();
  
  selectedCategory: string = 'All';
  selectedDifficulty: string = 'All';
  selectedQuestionType: string = 'All';
  searchQuery: string = '';
  
  loading: boolean = true;
  error: string | null = null;
  
  constructor(
    private practiceService: PracticeService,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef,
    private categoryService: CategoryService,
    private sanitizer: DomSanitizer
  ) {
    this.practiceQuestions$ = of([]);
    this.filteredQuestions$ = of([]);
  }

  ngOnInit(): void {
    // Register highlight.js languages
    this.registerHighlightJsLanguages();
    this.loadPracticeQuestions();
  }
  
  // Register languages for code highlighting
  private registerHighlightJsLanguages(): void {
    hljs.registerLanguage('javascript', javascript);
    hljs.registerLanguage('typescript', typescript);
    hljs.configure({
      ignoreUnescapedHTML: true,
      languages: ['javascript', 'typescript']
    });
  }
  
  // Process question descriptions to safely render HTML with code highlighting
  processDescription(description: string): SafeHtml {
    if (!description) return this.sanitizer.bypassSecurityTrustHtml('');
    
    // Check if we already processed this description
    if (this.processedDescriptions.has(description)) {
      return this.processedDescriptions.get(description)!;
    }
    
    // Process code blocks in the description
    const processedHTML = this.sanitizer.bypassSecurityTrustHtml(description);
    this.processedDescriptions.set(description, processedHTML);
    
    return processedHTML;
  }
  
  loadPracticeQuestions(): void {
    this.loading = true;
    this.cdr.markForCheck();
    
    // First load categories
    this.categoryService.getCategories().subscribe(
      (categories) => {
        // Create a map of category IDs to names
        categories.forEach(category => {
          if (category.id && category.name) {
            this.categoryMap.set(category.id, category.name);
          }
        });
        
        // Then load practice questions
        this.practiceService.getAllPracticeQuestions().subscribe(
          (questions) => {
            try {
              console.log('Loaded practice questions:', questions);
              
              // Map category IDs to names if possible
              const processedQuestions = questions.map(question => {
                if (question.category && this.categoryMap.has(question.category)) {
                  return {
                    ...question,
                    categoryName: this.categoryMap.get(question.category) || question.category
                  };
                }
                return question;
              });
              
              this.practiceQuestions$ = of(processedQuestions);
              this.filteredQuestions$ = this.practiceQuestions$;
              
              // Extract unique categories from valid questions
              const uniqueCategories = [...new Set(
                processedQuestions
                  .filter(q => q && q.category) // Filter out questions with no category
                  .map(q => q.categoryName || q.category)
              )];
              this.categories = uniqueCategories.sort();
              
              this.loading = false;
              this.cdr.detectChanges(); // Force change detection
              
              // Process code blocks after rendering
              setTimeout(() => {
                this.processCodeBlocks();
              }, 300);
            } catch (error) {
              console.error('Error processing practice questions:', error);
              this.error = 'Failed to process practice questions';
              this.loading = false;
              this.cdr.detectChanges();
            }
          },
          (error) => {
            console.error('Error loading practice questions:', error);
            this.error = 'Failed to load practice questions';
            this.loading = false;
            this.cdr.detectChanges();
          }
        );
      },
      (error) => {
        console.error('Error loading categories:', error);
        this.error = 'Failed to load categories';
        this.loading = false;
        this.cdr.detectChanges();
      }
    );
  }

  // Process code blocks on the page
  processCodeBlocks(): void {
    // Use setTimeout to ensure the DOM is ready
    setTimeout(() => {
      // Find all code blocks in the question cards
      const codeElements = document.querySelectorAll('.question-card pre code');
      if (codeElements.length > 0) {
        console.log('Found code elements in list view:', codeElements.length);
        codeElements.forEach((element) => {
          try {
            hljs.highlightElement(element as HTMLElement);
          } catch (e) {
            console.error('Error highlighting element:', e);
          }
        });
      }
    }, 100);
  }
  
  // Apply filters to questions list
  applyFilters(): void {
    this.filteredQuestions$ = this.practiceQuestions$.pipe(
      map(questions => 
        questions.filter(question => {
          // Category filter
          if (this.selectedCategory !== 'All' && 
              question.categoryName !== this.selectedCategory && 
              question.category !== this.selectedCategory) {
            return false;
          }
          
          // Difficulty filter
          if (this.selectedDifficulty !== 'All' && 
              question.difficulty !== this.selectedDifficulty) {
            return false;
          }
          
          // Question type filter
          if (this.selectedQuestionType !== 'All' && 
              question.questionType !== this.selectedQuestionType) {
            return false;
          }
          
          // Search query filter
          if (this.searchQuery.trim() !== '') {
            const query = this.searchQuery.toLowerCase();
            const matchesTitle = question.title.toLowerCase().includes(query);
            const matchesDescription = question.description.toLowerCase().includes(query);
            const matchesTags = question.tags?.some(tag => tag.toLowerCase().includes(query));
            
            if (!matchesTitle && !matchesDescription && !matchesTags) {
              return false;
            }
          }
          
          return true;
        })
      )
    );
    
    // Process code blocks after filtering
    setTimeout(() => {
      this.processCodeBlocks();
    }, 300);
    
    this.cdr.detectChanges();
  }
  
  // Get user-friendly label for question type
  getQuestionTypeLabel(type: string): string {
    switch (type) {
      case 'multiple-choice':
        return 'Multiple Choice';
      case 'coding':
        return 'Coding Challenge';
      default:
        return type;
    }
  }
  
  // Filter questions by tag
  filterByTag(tag: string): void {
    this.searchQuery = tag;
    this.applyFilters();
  }
  
  // Format success rate to display nicely
  formatSuccessRate(rate: number): string {
    if (rate === undefined || rate === null) return '0.00';
    return rate.toFixed(2);
  }
  
  // Toggle like/dislike for a question
  toggleLike(event: Event, questionId: string, isLike: boolean): void {
    event.stopPropagation(); // Prevent navigating to question
    
    if (!questionId) return;
    
    this.practiceService.likePracticeQuestion(questionId, isLike)
      .subscribe(
        () => {
          // Update UI optimistically
          this.practiceQuestions$ = this.practiceQuestions$.pipe(
            map(questions => 
              questions.map(q => {
                if (q.id === questionId) {
                  // Calculate new like count
                  let likeDelta = 0;
                  
                  if (isLike) {
                    if (q.userLiked) {
                      likeDelta = 0; // Already liked
                    } else if (q.userDisliked) {
                      likeDelta = 2; // Change from dislike to like (+2)
                    } else {
                      likeDelta = 1; // New like
                    }
                  } else {
                    if (q.userDisliked) {
                      likeDelta = 0; // Already disliked
                    } else if (q.userLiked) {
                      likeDelta = -2; // Change from like to dislike (-2)
                    } else {
                      likeDelta = -1; // New dislike
                    }
                  }
                  
                  // Update the question object
                  return {
                    ...q,
                    likes: (q.likes || 0) + likeDelta,
                    userLiked: isLike,
                    userDisliked: !isLike
                  };
                }
                return q;
              })
            )
          );
          
          // Re-apply filters to update the filtered list
          this.applyFilters();
          
          // Show success message
          this.toastr.success(isLike ? 'Question liked!' : 'Question disliked!');
        },
        (error) => {
          console.error('Error liking/disliking question:', error);
          this.toastr.error('Failed to record your feedback');
        }
      );
  }
  
  // Navigate to the practice question details
  viewPracticeQuestion(id: string): void {
    this.router.navigate(['/practice', id]);
  }
} 