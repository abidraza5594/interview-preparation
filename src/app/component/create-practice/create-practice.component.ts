import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, from } from 'rxjs';
import { finalize, take } from 'rxjs/operators';
import { CategoryService } from '../../services/category.service';
import { PracticeService } from '../../services/practice.service';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { QuillModule } from 'ngx-quill';

interface Category {
  id: string;
  name?: string;
  data?: any;
}

@Component({
  selector: 'app-create-practice',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    QuillModule
  ],
  templateUrl: './create-practice.component.html',
  styleUrls: ['./create-practice.component.scss']
})
export class CreatePracticeComponent implements OnInit {
  practiceForm!: FormGroup;
  categories: Category[] = [];
  difficultyLevels: string[] = ['easy', 'medium', 'hard'];
  questionTypes: string[] = ['multiple-choice', 'coding'];
  isSubmitting = false;
  loading = false;
  error: string | null = null;
  selectedCategory: string | null = null;
  questionType: 'multiple-choice' | 'coding' = 'multiple-choice';
  options: { text: string; isCorrect: boolean }[] = [];
  hints: { text: string }[] = [];
  testCases: { input: string; expectedOutput: string; isHidden: boolean }[] = [];
  codeTemplate: string = '';
  
  // Quill editor configuration
  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ 'header': 1 }, { 'header': 2 }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'direction': 'rtl' }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'font': [] }],
      [{ 'align': [] }],
      ['clean'],
      ['link', 'image', 'video']
    ]
  };

  constructor(
    private fb: FormBuilder,
    private practiceService: PracticeService,
    private categoryService: CategoryService,
    private router: Router,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.loadCategories();
    this.updateFormValidators(this.questionType);
  }

  // Custom validator for Quill editor content
  quillContentValidator(minLength: number = 20): any {
    return (control: any) => {
      const value = control.value;
      
      // Check if the value is empty or just contains HTML tags with no actual content
      if (!value || value === '<p><br></p>' || value === '<p></p>') {
        return { required: true };
      }
      
      // Remove HTML tags to check actual content length
      const textContent = value.replace(/<[^>]*>/g, '').trim();
      
      if (textContent.length < minLength) {
        return { minlength: { requiredLength: minLength, actualLength: textContent.length } };
      }
      
      return null;
    };
  }

  // Initialize the form with default values
  initForm(): void {
    this.practiceForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5)]],
      description: ['', [this.quillContentValidator(20)]],
      category: ['', Validators.required],
      difficulty: ['medium'],
      questionType: ['multiple-choice'],
      options: this.fb.array([]),
      solution: ['', [this.quillContentValidator(20)]],
      hints: this.fb.array([]),
      codeTemplate: [''],
      testCases: this.fb.array([]),
      timeLimit: [5, [Validators.required, Validators.min(1)]],
      memoryLimit: [128, [Validators.required, Validators.min(16)]],
      tags: [''],
      isPublished: [true]
    });

    // Initialize options with two default options (one correct)
    const optionsArray = this.optionsArray;
    optionsArray.push(this.createOptionGroup(true));
    optionsArray.push(this.createOptionGroup(false));

    // Initialize hints with one empty hint
    const hintsArray = this.hintsArray;
    hintsArray.push(this.createHintGroup());

    // Initialize test cases with one empty test case
    const testCasesArray = this.testCasesArray;
    testCasesArray.push(this.createTestCaseGroup());

    // Subscribe to question type changes
    this.practiceForm.get('questionType')?.valueChanges.subscribe(type => {
      this.questionType = type;
      this.updateFormValidators(type);
    });
  }

  // Update form validators based on question type
  updateFormValidators(questionType: 'multiple-choice' | 'coding'): void {
    // Remove all existing validators
    this.practiceForm.get('options')?.clearValidators();
    this.practiceForm.get('codeTemplate')?.clearValidators();
    this.practiceForm.get('testCases')?.clearValidators();
    
    if (questionType === 'multiple-choice') {
      // Add validators for multiple choice
      this.practiceForm.get('options')?.setValidators([
        Validators.required,
        (control: AbstractControl) => {
          const options = control.value;
          if (!options || options.length < 2) {
            return { minOptions: true };
          }
          const hasCorrect = options.some((opt: any) => opt.isCorrect);
          return hasCorrect ? null : { noCorrectOption: true };
        }
      ]);
      
      // Clear coding fields
      this.practiceForm.get('codeTemplate')?.setValue('');
    } else {
      // Add validators for coding
      this.practiceForm.get('codeTemplate')?.setValidators([Validators.required]);
      
      // Clear the options array for coding questions
      const optionsArray = this.optionsArray;
      while (optionsArray.length !== 0) {
        optionsArray.removeAt(0);
      }
      
      // Add a default test case if none exists
      if (this.testCasesArray.length === 0) {
        this.addTestCase();
      }
    }
    
    // Update validity for all controls
    this.practiceForm.get('options')?.updateValueAndValidity();
    this.practiceForm.get('codeTemplate')?.updateValueAndValidity();
    this.practiceForm.get('testCases')?.updateValueAndValidity();
    
    // Force the form to recalculate its validity
    this.practiceForm.updateValueAndValidity();
  }

  // Create a form group for an option
  createOptionGroup(isCorrect: boolean = false): FormGroup {
    return this.fb.group({
      text: ['', Validators.required],
      isCorrect: [isCorrect]
    });
  }

  // Create a form group for a hint
  createHintGroup(): FormGroup {
    return this.fb.group({
      text: ['']
    });
  }

  // Create a form group for a test case
  createTestCaseGroup(): FormGroup {
    return this.fb.group({
      input: [''],
      expectedOutput: [''],
      isHidden: [false]
    });
  }

  // Get the options form array
  get optionsArray(): FormArray {
    return this.practiceForm.get('options') as FormArray;
  }

  // Add a new option
  addOption(): void {
    this.optionsArray.push(this.createOptionGroup(false));
  }

  // Remove an option
  removeOption(index: number): void {
    if (this.optionsArray.length > 2) {
      this.optionsArray.removeAt(index);
    } else {
      this.toastr.warning('You need at least 2 options for a multiple choice question');
    }
  }

  // Get the hints form array
  get hintsArray(): FormArray {
    return this.practiceForm.get('hints') as FormArray;
  }

  // Get the test cases form array
  get testCasesArray(): FormArray {
    const control = this.practiceForm.get('testCases');
    if (!control) {
      // If the control doesn't exist, create it
      const testCasesArray = this.fb.array([this.createTestCaseGroup()]);
      this.practiceForm.addControl('testCases', testCasesArray);
      return testCasesArray;
    }
    return control as FormArray;
  }

  // Add a new hint
  addHint(): void {
    this.hintsArray.push(this.createHintGroup());
  }

  // Remove a hint
  removeHint(index: number): void {
    if (this.hintsArray.length > 1) {
      this.hintsArray.removeAt(index);
    }
  }

  // Add a new test case
  addTestCase(): void {
    this.testCasesArray.push(this.createTestCaseGroup());
  }

  // Remove a test case
  removeTestCase(index: number): void {
    if (this.testCasesArray.length > 1) {
      this.testCasesArray.removeAt(index);
    }
  }

  // Handle option correct change - ensures only one option is marked as correct
  onOptionCorrectChange(index: number): void {
    const optionsArray = this.optionsArray;
    
    // Set all options to not correct
    for (let i = 0; i < optionsArray.length; i++) {
      optionsArray.at(i).get('isCorrect')?.setValue(i === index);
    }
    
    // Mark the form as dirty to trigger validation
    this.practiceForm.markAsDirty();
    optionsArray.markAsDirty();
    
    // Update validity
    optionsArray.updateValueAndValidity();
    this.practiceForm.updateValueAndValidity();
  }

  // Process tags from comma-separated string to array
  processTags(tagsString: string): string[] {
    if (!tagsString) return [];
    
    return tagsString
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }

  // Check if the current question type is coding
  isCodingQuestion(): boolean {
    return this.practiceForm.get('questionType')?.value === 'coding';
  }

  // Check if the current question type is multiple choice
  isMultipleChoiceQuestion(): boolean {
    return this.practiceForm.get('questionType')?.value === 'multiple-choice';
  }

  // Submit the form
  onSubmit(): void {
    console.log('Form submitted, validity:', this.practiceForm.valid);
    console.log('Form errors:', this.getFormValidationErrors());
    
    if (this.practiceForm.valid) {
      this.loading = true;
      const formData = this.practiceForm.value;
      
      // Clean up the data based on question type
      const practiceData: any = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        difficulty: formData.difficulty,
        questionType: formData.questionType,
        solution: formData.solution,
        hints: formData.hints ? formData.hints.filter((hint: any) => hint && hint.text && hint.text.trim() !== '') : [],
        timeLimit: formData.timeLimit,
        memoryLimit: formData.memoryLimit,
        tags: formData.tags ? formData.tags.split(',').map((tag: string) => tag.trim()) : [],
        isPublished: formData.isPublished
      };

      // Add type-specific data
      if (formData.questionType === 'multiple-choice') {
        practiceData.options = formData.options;
        // Set coding fields to null
        practiceData.codeTemplate = null;
        practiceData.testCases = null;
      } else {
        practiceData.codeTemplate = formData.codeTemplate;
        // Filter out empty test cases
        practiceData.testCases = formData.testCases ? 
          formData.testCases.filter((tc: any) => 
            tc && 
            (tc.input && tc.input.trim() !== '') && 
            (tc.expectedOutput && tc.expectedOutput.trim() !== '')
          ) : [];
        // Use empty array instead of null for options
        practiceData.options = [];
      }

      console.log('Submitting practice data:', practiceData);

      this.practiceService.createPracticeQuestion(practiceData).subscribe(
        (id) => {
          this.toastr.success('Practice question created successfully!');
          this.router.navigate(['/practice', id]);
        },
        (error) => {
          console.error('Error creating practice question:', error);
          this.error = 'Failed to create practice question';
          this.toastr.error('Failed to create practice question: ' + (error.message || error));
        },
        () => {
          this.loading = false;
        }
      );
    } else {
      this.markFormGroupTouched(this.practiceForm);
      this.toastr.warning('Please fix the form errors before submitting');
      console.log('Form is invalid. Errors:', this.getFormValidationErrors());
    }
  }

  // Helper method to get all validation errors
  getFormValidationErrors() {
    const errors: any = {};
    Object.keys(this.practiceForm.controls).forEach(key => {
      const control = this.practiceForm.get(key);
      if (control && !control.valid) {
        errors[key] = control.errors;
      }
    });
    return errors;
  }

  // Mark all controls in a form group as touched
  markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      
      if (control) {
        control.markAsTouched();
        control.updateValueAndValidity();
        
        if (control instanceof FormGroup) {
          this.markFormGroupTouched(control);
        } else if (control instanceof FormArray) {
          for (let i = 0; i < control.length; i++) {
            const arrayControl = control.at(i);
            arrayControl.markAsTouched();
            arrayControl.updateValueAndValidity();
            
            if (arrayControl instanceof FormGroup) {
              this.markFormGroupTouched(arrayControl);
            }
          }
        }
      }
    });
  }

  // Cancel and navigate back
  cancel(): void {
    this.router.navigate(['/practice']);
  }

  // Load categories from the database
  loadCategories(): void {
    this.categoryService.getCategories().subscribe(
      (categories: Category[]) => {
        this.categories = categories;
        
        // If no categories exist, create test categories
        if (categories.length === 0) {
          this.createTestCategories();
        }
      },
      (error: Error) => {
        console.error('Error loading categories:', error);
        this.toastr.error('Failed to load categories. Please try again later.');
      }
    );
  }

  // Create test categories if none exist
  createTestCategories(): void {
    const testCategories = [
      { name: 'Algorithms', description: 'Algorithm-based problems' },
      { name: 'Data Structures', description: 'Data structure problems' },
      { name: 'Mathematics', description: 'Math problems and puzzles' },
      { name: 'String Manipulation', description: 'String processing problems' },
      { name: 'Dynamic Programming', description: 'DP problems' }
    ];

    testCategories.forEach(category => {
      from(this.categoryService.createCategory(category)).subscribe(
        (id: string) => {
          console.log(`Created test category: ${category.name} with ID: ${id}`);
          // Reload categories after creating test categories
          this.loadCategories();
        },
        (error: Error) => {
          console.error(`Error creating test category ${category.name}:`, error);
        }
      );
    });
  }

  // Check if there are no correct options selected
  hasNoCorrectOption(): boolean {
    if (!this.optionsArray || !this.optionsArray.value) {
      return true;
    }
    
    return !this.optionsArray.value.some((option: any) => option && option.isCorrect);
  }
}
