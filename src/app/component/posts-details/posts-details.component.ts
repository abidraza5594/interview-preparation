import { Component, ElementRef, HostListener, OnInit, ViewChild, AfterViewChecked, AfterViewInit } from '@angular/core';
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


@Component({
  selector: 'app-posts-details',
  templateUrl: './posts-details.component.html',
  styleUrls: ['./posts-details.component.css']
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
  
  // New properties for like and reply functionality
  showReplyForm: number | null = null;
  replyText: string = '';
  
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
    private categoryService: CategoryService
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

  ngOnInit(): void {
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
    this.postService.loadOnePost(postId).subscribe((post: any) => {
      if (!post) {
        console.error('Post not found');
        this.toaster.error('Post not found');
        return;
      }
      
      console.log('Post loaded successfully:', post);
      this.singlePostArray = post;
      
      // Process content for code highlighting
      if (this.singlePostArray && this.singlePostArray.content) {
        this.processedContent = this.processContentForCodeHighlighting(this.singlePostArray.content);
      }
      
      // Extract questions from content
      if (post && post.content) {
        try {
          // Get questions with proper structure
          const extractedQuestions = this.contentExtraction.extractQuestions(post.content);
          this.arrayOfAllQuestion = extractedQuestions.map((q: any) => ({
            question: q // This ensures each item has a 'question' property with 'text' inside
          }));
        } catch (error) {
          console.error('Error extracting questions:', error);
        }
      }
      
      // Load comments
      this.loadCommentsForPost(postId);
      
      // Load related posts
      if (post && post.category && post.category.Category) {
        this.loadRelatedPosts(post.category.Category, postId);
      }
      
      // Increment view count
      this.incrementViewCount(postId);
    });
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
        });
      },
      error => {
        console.error('Error loading related posts:', error);
      }
    );
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
          userName: this.loginUser.displayName || userName,
          userId: user.uid || 'unknownUserId',
          userIMG: userIMG,
          likes: 0,
          likedBy: [],
          replies: []
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

  scrollToQuestionOnInit(question: string) {
    if (!question) {
      console.error('Question text is undefined or null');
      return;
    }
    
    console.log('Scrolling to question:', question);
    const contentElement: HTMLElement = this.contentContainer.nativeElement;
    // Find all <h3> elements
    const h3Elements = contentElement.querySelectorAll('h3');
    console.log('Found h3 elements:', h3Elements.length);
    
    // Iterate through the <h3> elements and find the one with matching text content
    for (let i = 0; i < h3Elements.length; i++) {
      const h3Element = h3Elements[i] as HTMLElement;
      const h3Text = h3Element.textContent?.trim();
      console.log(`Comparing: "${h3Text}" with "${question}"`);
      
      if (h3Text === question) {
        // Scroll to the target element
        console.log('Found matching h3, scrolling to:', h3Text);
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
    }, 1000);
    
    // Apply again after a longer delay to catch any late-rendered content
    setTimeout(() => {
      this.applyCodeHighlighting();
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

  // Load comments for a post
  loadCommentsForPost(postId: string): void {
    this.commentCategoryId = postId;
    
    // Load comments for this post
    this.commentService.loadComment(postId).subscribe((comments: Array<any>) => {
      // Sorting comments by dateTime in ascending order
      const sortedComments = comments.sort((a, b) => {
        const dateTimeA = new Date((a.data as { dateTime: string }).dateTime).getTime();
        const dateTimeB = new Date((b.data as { dateTime: string }).dateTime).getTime();
        return dateTimeB - dateTimeA;
      });
      this.commentArray = sortedComments;
      
      // Update like status if user is logged in
      if (this.loginUser) {
        this.updateLikeStatus();
      }
    }, error => {
      console.error('Error loading comments:', error);
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
}