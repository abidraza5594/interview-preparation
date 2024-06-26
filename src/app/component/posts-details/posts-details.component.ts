import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NgZone } from '@angular/core';
import { PostsService } from '../../services/posts.service';
import { ContentExtractionService } from '../../services/content-extraction.service';
import { CommentsService } from '../../services/comments.service';
import { formatDate } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { AngularFireAuth } from '@angular/fire/compat/auth';


@Component({
  selector: 'app-posts-details',
  templateUrl: './posts-details.component.html',
  styleUrls: ['./posts-details.component.css']
})
export class PostsDetailsComponent implements OnInit {

  singlePostArray: any;
  category: any;
  arrayOfAllQuestion: any[] = [];
  @ViewChild('contentContainer', { static: false }) contentContainer!: ElementRef;
  commentForm: FormGroup;
  commentCategoryId: any
  commentArray: Array<any> = []
  loginUser: any
  filteredOptions: any[] | undefined;
  questions: any
  constructor(
    private route: ActivatedRoute,
    private postService: PostsService,
    private zone: NgZone,
    private contentExtraction: ContentExtractionService,
    private formBuilder: FormBuilder,
    private commentService: CommentsService,
    private authService: AuthService,
    private toaster: ToastrService,
    private afAuth: AngularFireAuth,
  ) {
    this.commentForm = this.formBuilder.group({
      comment: ['', [Validators.required, Validators.minLength(5)]]
    });
  }

  // page scroll progress bar
  progressIndicatorWidth: string = '0%';
  @HostListener('window:scroll', ['$event'])
  onScroll(event: any) {
    this.updateScrollIndicator();
  }
  updateScrollIndicator() {
    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    const documentHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrollPercentage = (scrollPosition / documentHeight) * 100;
    this.progressIndicatorWidth = scrollPercentage + '%';
  }
  getScrollIndicatorWidth() {
    return this.progressIndicatorWidth;
  }

  ngOnInit() {
    this.afAuth.authState.subscribe(user => {
      this.loginUser = user?.displayName
    });

    this.postService.loadFrontEndPost().subscribe(data => {
      this.category = data
    })
    this.route.params.subscribe((val: any) => {
      let id = this.route.snapshot.queryParamMap.get("id")
      this.commentCategoryId = id
      this.commentService.loadComment(id).subscribe((comments: Array<any>) => {
        // Sorting comments by dateTime in ascending order
        let Comments = comments.sort((a, b) => {
          const dateTimeA = new Date((a.data as { dateTime: string }).dateTime).getTime();
          const dateTimeB = new Date((b.data as { dateTime: string }).dateTime).getTime();
          return dateTimeB - dateTimeA;
        });
        this.commentArray = Comments;
      });
      this.postService.loadOnePost(id).subscribe(
        (post: any) => {
          this.zone.run(() => {
            this.singlePostArray = post;

            // Initialize the array before extracting questions
            this.arrayOfAllQuestion = [];

            // Assuming your extractQuestions method returns an array of questions
            const extractedQuestions = this.contentExtraction.extractQuestions(post.content);

            // Assign the extracted questions to arrayOfAllQuestion
            this.arrayOfAllQuestion = extractedQuestions.map((question, index) => ({
              question,
              id: `question_${index}`
            }));
          });
        },
        error => {
          console.error('Error loading post:', error);
        }
      );

    });
  }
  submitComment() {
    // Mark all controls in the form as touched
    this.markFormGroupTouched(this.commentForm);
    if (this.commentForm.valid) {
      const user = this.authService.getCurrentUser();
      if (user && this.authService.isAuthenticated()) {
        // User is authenticated
        let userName: string;
        if (user.displayName) {
          // If display name is available, use it
          userName = user.displayName;
        } else {
          // If display name is not available, use a default or the email
          userName = user.email ? user.email.split('@')[0] : 'Anonymous';
        }
        const userFromLocalStorageString = localStorage.getItem("user");
        const userFromLocalStorage = userFromLocalStorageString ? JSON.parse(userFromLocalStorageString) : null;
        const userIMG = userFromLocalStorage && userFromLocalStorage.user && userFromLocalStorage.user.photoURL
          ? userFromLocalStorage.user.photoURL
          : "https://icon-library.com/images/default-user-icon/default-user-icon-13.jpg";

        const comment = {
          comment: this.commentForm.value.comment,
          commentCategoryId: this.commentCategoryId,
          dateTime: this.getFormattedDateTimeWithTime(),
          userName: this.loginUser,
          userId: user.uid || 'unknownUserId',
          userIMG: userIMG
        };
        this.commentService.saveCommentData(comment);
        this.commentForm.reset();
      } else {
        // User is not authenticated, show a toast or redirect to the login page
        this.toaster.error('Please login to comment');
        // Replace the following line with your preferred method for showing a toast or redirecting
      }
    }
  }
  getFormattedDateTimeWithTime(): string {
    // Format the current date and time as 'MMM d, y h:mm a'
    return formatDate(new Date(), 'MMM d, y h:mm a', 'en-US');
  }
  // Recursive function to mark all form controls as touched
  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else {
        control.markAsTouched();
      }
    });
  }

  scrollToQuestionOnInit(question: any) {
    console.log(question)
    const contentElement: HTMLElement = this.contentContainer.nativeElement;
    // Find all <h3> elements
    const h3Elements = contentElement.querySelectorAll('h3');
    // Example question to scroll to
    const questionToScroll = question;
    // Iterate through the <h3> elements and find the one with matching text content
    for (let i = 0; i < h3Elements.length; i++) {
      const h3Element = h3Elements[i] as HTMLElement;
      if (h3Element.textContent?.trim() === questionToScroll) {
        // Scroll to the target element
        h3Element.scrollIntoView({ behavior: 'smooth' });
        break;
      }
    }
  }
  searchQuestions() {
    this.filteredOptions = this.arrayOfAllQuestion
      .filter(q => q.question?.text.toLowerCase().includes(this.questions.toLowerCase()))
      .map(q => q.question?.text);
  }
  scroltoQuestion() {
    this.scrollToQuestionOnInit(this.questions)
  }
}