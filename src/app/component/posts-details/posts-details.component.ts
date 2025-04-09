import { Component, ElementRef, HostListener, OnInit, ViewChild, AfterViewChecked, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgZone } from '@angular/core';
import { PostsService } from '../../services/posts.service';
import { ContentExtractionService } from '../../services/content-extraction.service';
import { CommentsService } from '../../services/comments.service';
import { formatDate } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import hljs from 'highlight.js';
import { CategoryService } from '../../services/category.service';
import firebase from 'firebase/compat/app';
import { take } from 'rxjs/operators';


@Component({
  selector: 'app-posts-details',
  templateUrl: './posts-details.component.html',
  styleUrls: ['./posts-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PostsDetailsComponent implements OnInit, AfterViewChecked, AfterViewInit {

  singlePostArray: any;
  processedContent: string = '';
  category: any;
  arrayOfAllQuestion: any[] = [];
  relatedPosts: any[] = [];
  @ViewChild('contentContainer', { static: false }) contentContainer!: ElementRef;
  commentForm: FormGroup;
  commentCategoryId: any
  commentArray: Array<any> = []
  loginUser: any
  filteredOptions: any[] | undefined;
  questions: any
  loading: boolean = false;
  error: string | null = null;
  
  // New properties for like and reply functionality
  showReplyForm: number | null = null;
  replyText: string = '';
  
  isMobileView: boolean = false;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postService: PostsService,
    private zone: NgZone,
    private contentExtraction: ContentExtractionService,
    private formBuilder: FormBuilder,
    private commentService: CommentsService,
    private authService: AuthService,
    private toaster: ToastrService,
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
    private categoryService: CategoryService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.commentForm = this.formBuilder.group({
      comment: ['', [Validators.required, Validators.minLength(5)]]
    });
    // Check initial screen size
    this.checkScreenSize();
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
    this.changeDetectorRef.markForCheck();
  }
  getScrollIndicatorWidth() {
    return this.progressIndicatorWidth;
  }

  ngOnInit(): void {
    // Ensure Monaco editor is properly loaded to avoid AMD/define conflicts
    if (typeof window !== 'undefined' && 'require' in window) {
      console.log('Monaco editor require available in posts-details component');
    }

    // First try to get the ID from the route params (/:id)
    this.route.params.subscribe(params => {
      let postId = params['id'];
      
      // If the ID contains a permalink format (title-id), extract the ID part
      if (postId && postId.includes('-')) {
        // Extract the ID from the end of the permalink
        const parts = postId.split('-');
        postId = parts[parts.length - 1];
      }
      
      // If not found in params, try to get it from query params (?id=xxx)
      if (!postId) {
        this.route.queryParams.subscribe(queryParams => {
          postId = queryParams['id'];
          if (postId) {
            this.loadPostDetails(postId);
          } else {
            console.error('No post ID found in URL');
            this.toaster.error('Post not found');
          }
        });
      } else {
        this.loadPostDetails(postId);
      }
    });
    
    this.afAuth.authState.subscribe((user: any) => {
      this.loginUser = user;
    });

    // Use CategoryService instead of PostsService for loading categories
    this.categoryService.getCategories().subscribe(
      (categories) => {
        this.category = categories;
        console.log('Loaded categories:', categories);
      },
      error => {
        console.error('Error loading categories:', error);
        this.toaster.error('Error loading categories');
      }
    );
  }
  
  // Load post details
  loadPostDetails(postId: string): void {
    console.log('Loading post with ID:', postId);
    this.loading = true;
    this.error = null;
    this.changeDetectorRef.markForCheck();
    
    this.postService.loadOnePost(postId).subscribe(
      (post: any) => {
        if (!post) {
          console.error('Post not found');
          this.toaster.error('Post not found');
          this.error = 'Post not found';
          this.loading = false;
          this.changeDetectorRef.markForCheck();
          return;
        }
        
        console.log('Post loaded successfully:', post);
        this.singlePostArray = post;
        
        // Set the commentCategoryId to the current post ID
        this.commentCategoryId = postId;
        
        // Process content for code highlighting
        if (this.singlePostArray && this.singlePostArray.content) {
          this.processedContent = this.processContentForHighlightingAndQuestions(this.singlePostArray.content);
        }
        
        // Load comments
        this.loadCommentsForPost(postId);
        
        // Load related posts
        if (post && post.category && post.category.Category) {
          this.loadRelatedPosts(post.category.Category, postId);
        }
        
        // Increment view count
        this.incrementViewCount(postId);
        
        this.loading = false;
        this.changeDetectorRef.markForCheck();
      },
      error => {
        console.error('Error loading post:', error);
        this.toaster.error('Error loading post');
        this.error = 'Error loading post';
        this.loading = false;
        this.changeDetectorRef.markForCheck();
      }
    );
  }
  
  loadRelatedPosts(category: string, currentPostId: string | null) {
    if (!currentPostId || !category) {
      console.warn('Cannot load related posts: missing category or post ID');
      return;
    }
    
    this.postService.loadLetestPosts().subscribe(
      (posts: any[]) => {
        this.zone.run(() => {
          // Filter posts by the same category and exclude the current post
          this.relatedPosts = posts
            .filter(post => {
              // Add null checks to prevent errors
              if (!post || !post.data) return false;
              
              const postCategory = post.data.category?.Category;
              return postCategory === category && post.id !== currentPostId;
            })
            .slice(0, 3); // Limit to 3 related posts
          
          console.log(`Found ${this.relatedPosts.length} related posts for category: ${category}`);
          this.changeDetectorRef.markForCheck();
        });
      },
      error => {
        console.error('Error loading related posts:', error);
        this.changeDetectorRef.markForCheck();
      }
    );
  }
  
  submitComment() {
    // Mark all controls in the form as touched
    this.markFormGroupTouched(this.commentForm);
    if (this.commentForm.valid) {
      if (!this.authService.isAuthenticated()) {
        this.toaster.error('Please login to comment');
        return;
      }
      
      // Use Observable correctly with subscription
      this.authService.getCurrentUser().pipe(
        take(1)
      ).subscribe(user => {
        if (!user) {
          this.toaster.error('Please login to comment');
          return;
        }
        
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
          userName: this.loginUser.displayName || userName,
          userId: user.uid,
          userIMG: userIMG,
          likes: 0,
          likedBy: [],
          replies: []
        };
        
        this.commentService.saveCommentData(comment);
        this.commentForm.reset();
      });
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

  scrollToQuestionOnInit(questionText: string) {
    if (!questionText || !this.contentContainer) {
      console.error('Question text is undefined or content container not available');
      return;
    }
    
    console.log('Scrolling to question:', questionText);
    const contentElement: HTMLElement = this.contentContainer.nativeElement;
    // Find all <h3> elements
    const h3Elements = contentElement.querySelectorAll('h3');
    console.log('Found h3 elements:', h3Elements.length);
    
    // Iterate through the <h3> elements and find the one with matching text content
    let found = false;
    for (let i = 0; i < h3Elements.length; i++) {
      const h3Element = h3Elements[i] as HTMLElement;
      const h3Text = h3Element.textContent?.trim();
      
      if (h3Text === questionText) {
        // Get the navbar height to offset scrolling
        const navbarHeight = this.isMobileView ? 50 : 65;
        
        // Calculate the element's position
        const elementPosition = h3Element.getBoundingClientRect().top + window.pageYOffset;
        
        // Scroll to the target element with smooth behavior and offset for navbar
        window.scrollTo({
          top: elementPosition - navbarHeight - 20, // additional 20px for padding
          behavior: 'smooth'
        });
        
        // Highlight the element temporarily
        const originalBackground = h3Element.style.backgroundColor;
        h3Element.style.backgroundColor = '#ffffcc';
        h3Element.style.transition = 'background-color 2s';
        
        setTimeout(() => {
          h3Element.style.backgroundColor = originalBackground;
        }, 2000);
        
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.warn('Question not found in content:', questionText);
      this.toaster.info('Question not found in content');
    }
  }
  searchQuestions() {
    this.filteredOptions = this.arrayOfAllQuestion
      .filter(q => q.question?.text.toLowerCase().includes(this.questions.toLowerCase()))
      .map(q => q.question?.text);
    this.changeDetectorRef.markForCheck();
  }
  scroltoQuestion() {
    this.scrollToQuestionOnInit(this.questions)
  }

  // Update like status for comments and replies
  updateLikeStatus() {
    if (!this.loginUser || !this.commentArray) return;
    
    this.commentArray.forEach(comment => {
      // Check if likedBy array exists, if not initialize it
      if (!comment.data.likedBy) {
        comment.data.likedBy = [];
      }
      
      // Check if user has liked this comment
      comment.data.isLikedByCurrentUser = comment.data.likedBy.includes(this.loginUser.uid);
      
      // Check replies if they exist
      if (comment.data.replies && comment.data.replies.length > 0) {
        comment.data.replies.forEach((reply: any) => {
          // Check if likedBy array exists, if not initialize it
          if (!reply.likedBy) {
            reply.likedBy = [];
          }
          
          reply.isLikedByCurrentUser = reply.likedBy.includes(this.loginUser.uid);
        });
      }
    });
    this.changeDetectorRef.markForCheck();
  }
  
  // Toggle reply form visibility
  toggleReplyForm(index: number): void {
    if (!this.loginUser) {
      this.toaster.warning('Please login to reply to comments');
      return;
    }
    
    this.showReplyForm = this.showReplyForm === index ? null : index;
    this.replyText = '';
  }
  
  // Add a reply to a comment
  addReply(commentId: string, commentIndex: number): void {
    if (!this.loginUser) {
      this.toaster.warning('Please login to reply to comments');
      return;
    }
    
    if (!this.replyText.trim()) {
      return;
    }
    
    const reply = {
      id: this.afs.createId(),
      text: this.replyText,
      userName: this.loginUser.displayName || 'Anonymous',
      userIMG: this.loginUser.photoURL || 'https://icon-library.com/images/default-user-icon/default-user-icon-13.jpg',
      userId: this.loginUser.uid,
      dateTime: formatDate(new Date(), 'MMM d, y h:mm a', 'en-US'),
      likes: 0,
      likedBy: [],
      isLikedByCurrentUser: false
    };
    
    // Update the comment in Firestore
    const commentRef = this.afs.collection('comment').doc(commentId);
    
    commentRef.get().subscribe(doc => {
      if (doc.exists) {
        const commentData = doc.data() as any;
        const replies = commentData.replies || [];
        replies.push(reply);
        
        commentRef.update({ replies }).then(() => {
          // Update local array
          if (!this.commentArray[commentIndex].data.replies) {
            this.commentArray[commentIndex].data.replies = [];
          }
          this.commentArray[commentIndex].data.replies.push(reply);
          
          this.toaster.success('Reply added successfully');
          this.replyText = '';
          this.showReplyForm = null;
        }).catch(error => {
          this.toaster.error('Error adding reply');
          console.error('Error adding reply:', error);
        });
      }
    });
  }
  
  // Like a comment
  likeComment(commentId: string, commentIndex: number): void {
    if (!this.loginUser) {
      this.toaster.warning('Please login to like comments');
      return;
    }
    
    const commentRef = this.afs.collection('comment').doc(commentId);
    
    commentRef.get().subscribe(doc => {
      if (doc.exists) {
        const commentData = doc.data() as any;
        let likes = commentData.likes || 0;
        let likedBy = commentData.likedBy || [];
        const userId = this.loginUser.uid;
        
        // Toggle like
        const userLikedIndex = likedBy.indexOf(userId);
        if (userLikedIndex !== -1) {
          // Unlike
          likes--;
          likedBy.splice(userLikedIndex, 1);
        } else {
          // Like
          likes++;
          likedBy.push(userId);
        }
        
        // Update Firestore
        commentRef.update({ likes, likedBy }).then(() => {
          // Update local array
          this.commentArray[commentIndex].data.likes = likes;
          this.commentArray[commentIndex].data.likedBy = likedBy;
          this.commentArray[commentIndex].data.isLikedByCurrentUser = userLikedIndex === -1;
        }).catch(error => {
          this.toaster.error('Error updating like');
          console.error('Error updating like:', error);
        });
      }
    });
  }
  
  // Like a reply
  likeReply(commentId: string, replyId: string, commentIndex: number): void {
    if (!this.loginUser) {
      this.toaster.warning('Please login to like replies');
      return;
    }
    
    const commentRef = this.afs.collection('comment').doc(commentId);
    
    commentRef.get().subscribe(doc => {
      if (doc.exists) {
        const commentData = doc.data() as any;
        const replies = commentData.replies || [];
        const replyIndex = replies.findIndex((r: any) => r.id === replyId);
        
        if (replyIndex !== -1) {
          let reply = replies[replyIndex];
          let likes = reply.likes || 0;
          let likedBy = reply.likedBy || [];
          const userId = this.loginUser.uid;
          
          // Toggle like
          const userLikedIndex = likedBy.indexOf(userId);
          if (userLikedIndex !== -1) {
            // Unlike
            likes--;
            likedBy.splice(userLikedIndex, 1);
            reply.isLikedByCurrentUser = false;
          } else {
            // Like
            likes++;
            likedBy.push(userId);
            reply.isLikedByCurrentUser = true;
          }
          
          reply.likes = likes;
          reply.likedBy = likedBy;
          replies[replyIndex] = reply;
          
          // Update Firestore
          commentRef.update({ replies }).then(() => {
            // Update local array
            if (this.commentArray[commentIndex].data.replies) {
              const localReplyIndex = this.commentArray[commentIndex].data.replies.findIndex((r: any) => r.id === replyId);
              if (localReplyIndex !== -1) {
                this.commentArray[commentIndex].data.replies[localReplyIndex] = reply;
              }
            }
          }).catch(error => {
            this.toaster.error('Error updating like');
            console.error('Error updating like:', error);
          });
        }
      }
    });
  }

  ngAfterViewChecked() {
    this.applyCodeHighlighting();
  }

  ngAfterViewInit() {
    // Apply code highlighting after view is initialized
    // Use a longer timeout to ensure content is fully rendered
    setTimeout(() => {
      this.applyCodeHighlighting();
      this.checkScreenSize(); // Ensure responsive layout is applied
    }, 1000);
    
    // Apply again after a longer delay to catch any late-rendered content
    setTimeout(() => {
      this.applyCodeHighlighting();
      this.checkScreenSize(); // Check again for any dynamic changes
    }, 3000);
  }

  // Apply code highlighting to pre and code tags
  applyCodeHighlighting() {
    if (this.contentContainer && this.contentContainer.nativeElement) {
      try {
        // First, handle any remaining pre.ql-syntax elements that weren't processed during content processing
        const qlSyntaxElements = this.contentContainer.nativeElement.querySelectorAll('pre.ql-syntax');
        qlSyntaxElements.forEach((preEl: HTMLElement) => {
          // If it doesn't already have a code element inside, wrap the content in a code element
          if (!preEl.querySelector('code')) {
            const content = preEl.textContent || '';
            const language = this.detectLanguage(content);
            
            // Create a code element
            const codeEl = document.createElement('code');
            codeEl.className = `language-${language}`;
            codeEl.textContent = content;
            
            // Clear the pre element and append the code element
            preEl.textContent = '';
            preEl.appendChild(codeEl);
            
            // Remove the ql-syntax class and add our own class
            preEl.classList.remove('ql-syntax');
            preEl.classList.add('code-block');
          }
        });
        
        // Add language class to code blocks if not present
        const preElements = this.contentContainer.nativeElement.querySelectorAll('pre');
        preElements.forEach((preEl: HTMLElement) => {
          const codeEl = preEl.querySelector('code');
          if (codeEl && !codeEl.className) {
            // Try to detect language or set a default
            const content = codeEl.textContent || '';
            if (content.includes('def ') && (content.includes(':') || content.includes('return'))) {
              codeEl.className = 'language-python';
            } else if (content.includes('function') || content.includes('var') || content.includes('const')) {
              codeEl.className = 'language-javascript';
            } else if (content.includes('class') || content.includes('interface')) {
              codeEl.className = 'language-typescript';
            } else if (content.includes('<div') || content.includes('<span')) {
              codeEl.className = 'language-html';
            } else if (content.includes('{') && content.includes('}') && content.includes(':')) {
              codeEl.className = 'language-css';
            } else {
              codeEl.className = 'language-plaintext';
            }
          }
        });

        // Highlight all code blocks
        const codeBlocks = this.contentContainer.nativeElement.querySelectorAll('pre code');
        console.log('Found code blocks:', codeBlocks.length);
        
        codeBlocks.forEach((block: HTMLElement) => {
          if (!block.classList.contains('hljs')) {
            console.log('Highlighting code block:', block.textContent?.substring(0, 20));
            hljs.highlightElement(block);
          }
        });
        
        // Also highlight inline code
        const inlineCodeBlocks = this.contentContainer.nativeElement.querySelectorAll('code:not(pre code)');
        console.log('Found inline code blocks:', inlineCodeBlocks.length);
        
        inlineCodeBlocks.forEach((block: HTMLElement) => {
          if (!block.classList.contains('hljs')) {
            console.log('Highlighting inline code block:', block.textContent?.substring(0, 20));
            hljs.highlightElement(block);
          }
        });
      } catch (error) {
        console.error('Error applying code highlighting:', error);
      }
    }
  }

  // Increment view count for the post
  incrementViewCount(postId: string | null): void {
    if (!postId) {
      console.error('Cannot increment view count: post ID is null');
      return;
    }
    
    // Use a session storage flag to prevent multiple increments in the same session
    const viewedKey = `post_viewed_${postId}`;
    if (sessionStorage.getItem(viewedKey)) {
      return; // Already viewed in this session
    }
    
    // Set the flag in session storage
    sessionStorage.setItem(viewedKey, 'true');
    
    // Update the view count in Firestore
    const postRef = this.afs.doc(`posts/${postId}`);
    postRef.update({
      views: firebase.firestore.FieldValue.increment(1)
    }).then(() => {
      console.log('View count incremented');
    }).catch(error => {
      console.error('Error incrementing view count:', error);
    });
  }

  // Combined method to process content for highlighting and extract questions
  private processContentForHighlightingAndQuestions(content: string): string {
    try {
      // Extract questions before we modify the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      const h3Elements = doc.querySelectorAll('h3');
      console.log('Found h3 elements:', h3Elements.length);
      
      // Process questions from h3 elements
      this.arrayOfAllQuestion = Array.from(h3Elements).map((h3: HTMLHeadingElement, index: number) => {
        const id = `question_${index}`;
        const text = h3.textContent?.trim() || `Question ${index + 1}`;
        
        // Add ID to each h3 element for smooth scrolling
        h3.id = id;
        
        return {
          question: {
            text: text,
            id: id
          }
        };
      });
      
      console.log('Extracted questions:', this.arrayOfAllQuestion);
      
      // Now process the content for syntax highlighting
      const processedContent = this.processContentForCodeHighlighting(content);
      
      // Ensure the IDs are preserved in the processed content
      setTimeout(() => {
        if (this.contentContainer) {
          const h3Elements = this.contentContainer.nativeElement.querySelectorAll('h3');
          this.arrayOfAllQuestion.forEach((q, index) => {
            if (h3Elements[index]) {
              h3Elements[index].id = q.question.id;
            }
          });
        }
      }, 100);
      
      return processedContent;
    } catch (error) {
      console.error('Error processing content:', error);
      this.arrayOfAllQuestion = [];
      return content;
    }
  }

  // Process content to add syntax highlighting to code blocks
  processContentForCodeHighlighting(content: string): string {
    if (!content) return '';
    
    // First handle Quill editor's pre tags with ql-syntax class
    let processedContent = content.replace(/<pre class="ql-syntax">([\s\S]*?)<\/pre>/g, (match, codeContent) => {
      // Clean the code content
      const cleanedCode = this.decodeHtmlEntities(codeContent.trim());
      
      // Determine language
      const language = this.detectLanguage(cleanedCode);
      
      // Return formatted code block
      return `<pre><code class="language-${language}">${cleanedCode}</code></pre>`;
    });
    
    // Then handle regular pre tags
    processedContent = processedContent.replace(/<pre(?! class="ql-syntax")>([\s\S]*?)<\/pre>/g, (match, codeContent) => {
      // Clean the code content
      const cleanedCode = this.decodeHtmlEntities(codeContent.trim());
      
      // Determine language
      const language = this.detectLanguage(cleanedCode);
      
      // Return formatted code block
      return `<pre><code class="language-${language}">${cleanedCode}</code></pre>`;
    });
    
    // Replace inline code tags
    processedContent = processedContent.replace(/<code>([\s\S]*?)<\/code>/g, (match, codeContent) => {
      const cleanedCode = this.decodeHtmlEntities(codeContent.trim());
      return `<code>${cleanedCode}</code>`;
    });
    
    return processedContent;
  }
  
  // Helper method to decode HTML entities
  decodeHtmlEntities(html: string): string {
    if (!html) return '';
    
    // Replace &nbsp; with spaces first
    html = html.replace(/&nbsp;/g, ' ');
    
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    return textarea.value;
  }
  
  // Simple language detection (can be enhanced)
  detectLanguage(code: string): string {
    // Default to javascript
    let language = 'javascript';
    
    // Check for common language patterns
    if (code.includes('class') && code.includes('public') && (code.includes('{') || code.includes('}'))) {
      if (code.includes('System.out.println')) {
        language = 'java';
      } else if (code.includes('cout <<') || code.includes('iostream')) {
        language = 'cpp';
      } else if (code.includes('def __init__') || code.includes('import ') && !code.includes(';')) {
        language = 'python';
      } else if (code.includes('func ') && code.includes('fmt.')) {
        language = 'go';
      }
    } else if (code.includes('def ') && code.includes(':') && !code.includes(';')) {
      language = 'python';
    } else if (code.includes('<html>') || code.includes('<!DOCTYPE')) {
      language = 'html';
    } else if (code.includes('SELECT ') && code.includes('FROM ')) {
      language = 'sql';
    } else if (code.includes('<?php')) {
      language = 'php';
    }
    
    return language;
  }

  // Load comments for post
  loadCommentsForPost(postId: string): void {
    this.commentService.loadComment(postId).subscribe((val: Array<any>) => {
      this.commentArray = val;
      this.updateLikeStatus();
      this.changeDetectorRef.markForCheck();
    });
  }

  // Helper method to create a permalink from a title
  createPermalink(title: string): string {
    if (!title) return '';
    // Convert to lowercase, replace spaces with hyphens, remove special characters
    return title
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '-');
  }

  // Navigation methods for category and tags
  navigateToCategory(category: string): void {
    if (!category) return;
    this.router.navigate(['/category', category]);
  }

  navigateToPostType(postType: string): void {
    if (!postType) return;
    this.router.navigate(['/category', postType]);
  }
  
  // Get the proper category value to use for routing
  getCategoryValue(category: any): string {
    if (!category) return '';
    
    // If we have a direct string value in category.data.category, use that
    if (typeof category.data?.category === 'string') {
      return category.data.category;
    }
    
    // If we have the object format with Category property
    if (category.data?.category?.Category) {
      return category.data.category.Category;
    }
    
    // Try the name property
    if (category.name) {
      return category.name;
    }
    
    // Fallback to ID
    return category.id;
  }

  // Check screen size for responsive adjustments
  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.isMobileView = window.innerWidth < 768;
    this.changeDetectorRef.markForCheck();
    
    // Adjust styles for mobile view
    if (this.isMobileView) {
      // Remove sticky positioning for practice button on very small screens
      if (window.innerWidth < 576) {
        const practiceElement = document.querySelector('.practiceSticky') as HTMLElement;
        if (practiceElement) {
          practiceElement.style.position = 'relative';
          practiceElement.style.top = 'auto';
        }
        
        // Adjust the search form position
        const searchForm = document.querySelector('.search-form') as HTMLElement;
        if (searchForm) {
          searchForm.style.top = '50px';
        }
        
        // Adjust the questions list position
        const questionsList = document.querySelector('.stickypart') as HTMLElement;
        if (questionsList) {
          questionsList.style.top = '100px';
        }
      }
    } else {
      // Adjust for desktop view
      const searchForm = document.querySelector('.search-form') as HTMLElement;
      if (searchForm) {
        searchForm.style.top = '65px';
      }
      
      const questionsList = document.querySelector('.stickypart') as HTMLElement;
      if (questionsList) {
        questionsList.style.top = '120px';
      }
      
      const practiceElement = document.querySelector('.practiceSticky') as HTMLElement;
      if (practiceElement) {
        practiceElement.style.top = '580px';
      }
    }
  }
}