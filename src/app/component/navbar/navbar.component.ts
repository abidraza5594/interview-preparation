import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { PostsService } from '../../services/posts.service';
import { SharedScrollService } from '../../services/shared-scroll.service';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { CategoryService } from '../../services/category.service';
import { AuthService } from '../../services/auth.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { ThemeService } from '../../services/theme.service';
import { WebsocketService } from '../../services/websocket.service';

interface Post {
  id: string;
  data: {
    title: string;
    category: {
      Category: string;
    };
    permalink: string;
  };
}

interface RawPost {
  id: string;
  data: any;
}

interface Category {
  catname: string;
  catID: string;
  permalink: string;
}

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {
  isDropdownOpen = false;
  isProfileDropdownOpen = false;
  isCanvasMenuOpen = false;
  isSearchPopupOpen = false;
  isShowLogOut = false;
  isAdmin = false;
  isDarkMode = false;
  isNavbarHidden = false;
  searchControl = new FormControl('');
  filteredOptions: Observable<string[]>;
  categoryArray: Category[] = [];
  uniqueCategories: Category[] = [];
  allPost: Post[] = [];
  currentUser: any = null;
  lastScrollTop = 0;
  scrollThreshold = 50;

  // websocket
  serverUrl = '';
  websocketUrl = '';
  private serverInfoSub!: Subscription;

  // Add codingQuotes array property
  codingQuotes: string[] = [
    "Code is like humor. When you have to explain it, it's bad.",
    "First, solve the problem. Then, write the code.",
    "Programming isn't about what you know; it's about what you can figure out.",
    "The best error message is the one that never shows up.",
    "Clean code always looks like it was written by someone who cares.",
    "Every great developer you know got there by solving problems they were unqualified to solve.",
    "Make it work, make it right, make it fast.",
    "Simplicity is the soul of efficiency.",
    "Testing leads to failure, and failure leads to understanding.",
    "Any fool can write code that a computer can understand. Good programmers write code that humans can understand."
  ];

  constructor(
    private postService: PostsService,
    private shereScrollService: SharedScrollService,
    private categoryService: CategoryService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private firestore: AngularFirestore,
    private themeService: ThemeService,
    private websocketService: WebsocketService
  ) {
    // Initialize filtered options for search
    this.filteredOptions = this.searchControl.valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value || ''))
    );
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Always show navbar at the top of the page
    if (currentScrollTop < this.scrollThreshold) {
      this.isNavbarHidden = false;
      this.lastScrollTop = currentScrollTop;
      this.cdr.detectChanges();
      return;
    }
    
    // Calculate scroll difference
    const scrollDifference = Math.abs(currentScrollTop - this.lastScrollTop);
    
    // Only respond to substantial scrolls
    if (scrollDifference < 10) {
      return;
    }
    
    // Scrolling down - hide only the main navbar
    if (currentScrollTop > this.lastScrollTop && currentScrollTop > 100) {
      this.isNavbarHidden = true;
    } 
    // Scrolling up - show the main navbar again
    else if (currentScrollTop < this.lastScrollTop) {
      this.isNavbarHidden = false;
    }
    
    this.lastScrollTop = currentScrollTop;
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.isSearchPopupOpen) {
      this.toggleSearchPopup();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Close dropdowns when clicking outside
    if (this.isDropdownOpen || this.isProfileDropdownOpen) {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-toggle') && !target.closest('.dropdown-menu')) {
        this.isDropdownOpen = false;
        this.isProfileDropdownOpen = false;
      }
    }
    
    // Close canvas menu when clicking outside (unless we're clicking the toggle button)
    if (this.isCanvasMenuOpen) {
      const target = event.target as HTMLElement;
      if (!target.closest('.canvas-menu') && !target.closest('.burger-menu')) {
        this.isCanvasMenuOpen = false;
      }
    }
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      this.isProfileDropdownOpen = false;
    }
  }

  toggleProfileDropdown(event: Event) {
    event.preventDefault();
    this.isProfileDropdownOpen = !this.isProfileDropdownOpen;
    if (this.isProfileDropdownOpen) {
      this.isDropdownOpen = false;
    }
  }

  toggleCanvasMenu() {
    this.isCanvasMenuOpen = !this.isCanvasMenuOpen;
  }

  toggleSearchPopup() {
    this.isSearchPopupOpen = !this.isSearchPopupOpen;
  }

  scrollToFeature() {
    this.router.navigate(['/']);
    setTimeout(() => {
      this.shereScrollService.emitScrollEvent();
    });
  }

  scrollToLetest() {
    this.router.navigate(['/']);
    setTimeout(() => {
      this.shereScrollService.goToLetestSection();
    });
  }

  sendEmail() {
    window.location.href = 'mailto:abidraza8104@gmail.com.com?subject=Subject&body=Unlock interview success! Dive into expert-curated coding questions. Elevate your skills with Interview Preparation. Explore now: https://interviewpreparation.netlify.app/.';
  }

  sendWhatsAppMessage() {
    const recipientNumber = '+918104184175';
    const message = 'Hello, this is a WhatsApp message from my Angular app!';

    const whatsappLink = this.shereScrollService.generateWhatsAppLink(recipientNumber, message);
    window.location.href = whatsappLink;
  }

  ngOnInit() {
    this.fetchCodingQuotes();
    this.websocketConnect();
    // Subscribe to auth state changes
    this.authService.isAuthenticated().subscribe(isLoggedIn => {
      this.isShowLogOut = isLoggedIn;

      if (isLoggedIn) {
        this.getCurrentUserInfo();
      } else {
        this.isAdmin = false;
        this.currentUser = null;
      }
    });

    // Also check localStorage for token in case page is refreshed
    const token = localStorage.getItem('token');
    if (token) {
      this.isShowLogOut = true;
      this.getCurrentUserInfo();
    }

    // Load posts and categories
    this.loadPosts();
    this.loadCategories();

    // Subscribe to theme changes
    this.themeService.darkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
      this.cdr.detectChanges();
    });
  }

  getCurrentUserInfo() {
    const userString = localStorage.getItem('user');
    if (userString) {
      try {
        this.currentUser = JSON.parse(userString);

        // Check if user is admin
        if (this.currentUser && this.currentUser.uid) {
          this.checkAdminRole(this.currentUser.uid);
        } else if (this.currentUser && this.currentUser.user && this.currentUser.user.uid) {
          this.checkAdminRole(this.currentUser.user.uid);
        }
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
  }

  checkAdminRole(uid: string) {
    // Check if user has admin role in Firestore
    this.firestore.collection('users').doc(uid).get().subscribe(doc => {
      if (doc.exists) {
        const userData = doc.data() as any;
        this.isAdmin = userData && userData.role === 'admin';
        this.cdr.detectChanges(); // Force change detection
      }
    });
  }

  private loadPosts() {
    this.postService.loadLetestPosts().subscribe((posts: RawPost[]) => {
      this.allPost = posts.map(post => ({
        id: post.id,
        data: {
          title: post.data?.title || '',
          category: {
            Category: post.data?.category?.Category || ''
          },
          permalink: post.data?.permalink || ''
        }
      }));

      // After posts are loaded, load categories
      this.loadCategories();
    });
  }

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    // Return full Post objects instead of just titles for easier selection
    const filteredPosts = this.allPost
      .filter(post => post.data.title.toLowerCase().includes(filterValue));
    
    return filteredPosts.map(post => post.data.title);
  }

  onOptionSelected(event: any) {
    const selectedTitle = event.option.value;
    const selectedPost = this.allPost.find(
      post => post.data.title === selectedTitle
    );
    
    if (selectedPost) {
      this.router.navigate(['/post', selectedPost.id]);
      this.toggleSearchPopup(); // Close popup after search
      this.searchControl.setValue(''); // Clear search field
    }
  }

  onSubmit() {
    const searchValue = this.searchControl.value || '';
    if (searchValue.trim()) {
      const selectedPost = this.allPost.find(
        post => post.data.title.toLowerCase() === searchValue.toLowerCase()
      );
      
      if (selectedPost) {
        this.router.navigate(['/post', selectedPost.id]);
        this.toggleSearchPopup(); // Close popup after search
      } else {
        // Handle case when no exact match is found
        // Either show a message or search for partial matches
        const partialMatches = this.allPost.filter(
          post => post.data.title.toLowerCase().includes(searchValue.toLowerCase())
        );
        
        if (partialMatches.length > 0) {
          this.router.navigate(['/post', partialMatches[0].id]);
          this.toggleSearchPopup(); // Close popup after search
        }
      }
      
      // Clear search field after submitting
      this.searchControl.setValue('');
    }
  }

  handleLinkClick(category: any) {
    this.router.navigate(['/category', category.catID]);
  }

  logOut() {
    this.authService.logOut();
  }

  private loadCategories() {
    // First check if we have posts
    if (!this.allPost || this.allPost.length === 0) {
      // console.log('No posts available for category mapping');
      return;
    }

    this.categoryService.loadData().subscribe((val: any[]) => {
      let cat: Category[] = [];

      // Process each post
      for (let p of this.allPost) {
        try {
          if (p && p.data && p.data.category && p.data.category.Category) {
            let postcatID = p.id;
            let postcat = p.data.category.Category;

            // Process each category
            for (let c of val) {
              if (c && c.data && c.data.category && c.data.category.Category) {
                let catobj = c.data.category.Category;
                if (postcat === catobj) {
                  let catOBJ = {
                    catname: catobj,
                    catID: postcatID,
                    permalink: p.data.permalink
                  };
                  cat.push(catOBJ);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing post for category:', error);
        }
      }

      this.categoryArray = cat;

      // Filter out duplicate categories based on catname
      const uniqueMap = new Map<string, Category>();
      for (const category of this.categoryArray) {
        if (category.catname && !uniqueMap.has(category.catname)) {
          uniqueMap.set(category.catname, category);
        }
      }
      this.uniqueCategories = Array.from(uniqueMap.values());

      // console.log('Unique categories:', this.uniqueCategories);
    }, error => {
      console.error('Error loading categories:', error);
    });
  }

  websocketConnect() {
    // Connect to WebSocket server (adjust the URL as needed)
    this.websocketService.connect('ws://localhost:8080');

    // Subscribe to server info
    this.serverInfoSub = this.websocketService.serverInfo.subscribe(info => {
      this.serverUrl = info.http_url;
      this.websocketUrl = info.websocket_url;
      console.log('Server URL:', this.serverUrl);
      console.log('WebSocket URL:', this.websocketUrl);
    });
  }

  toggleDarkMode() {
    this.themeService.toggleDarkMode();
  }
  ngOnDestroy() {
    this.serverInfoSub.unsubscribe();
    this.websocketService.disconnect();
  }

  navigateToSponsorship(event: Event): void {
    // Uncomment and add real URL when available
    // window.open('https://real-sponsorship-url.com', '_blank');
    console.log('Navigating to sponsorship page');
    // If you want to prevent default for now (during development)
    event.preventDefault();
  }

  navigateToBrandCollaboration(event: Event): void {
    // Uncomment and add real URL when available
    // window.open('https://real-brand-collaboration-url.com', '_blank');
    console.log('Navigating to brand collaboration page');
    // If you want to prevent default for now (during development)
    event.preventDefault();
  }

  navigateToAffiliateMarketing(event: Event): void {
    // Uncomment and add real URL when available
    // window.open('https://real-affiliate-marketing-url.com', '_blank');
    console.log('Navigating to affiliate marketing page');
    // If you want to prevent default for now (during development)
    event.preventDefault();
  }

  // Method to fetch quotes (you can call this in ngOnInit)
  fetchCodingQuotes(): void {
    // You can replace this with actual API call if needed
    const fetchFromAPI = false;

    if (fetchFromAPI) {
      // Example API call using HttpClient (make sure to inject HttpClient in constructor)
      // this.http.get<any>('https://programming-quotes-api.herokuapp.com/quotes/random/5')
      //   .subscribe(
      //     (data) => {
      //       this.codingQuotes = data.map((quote: any) => quote.en);
      //     },
      //     (error) => {
      //       console.error('Error fetching quotes:', error);
      //     }
      //   );
    } else {
      // Just shuffle the existing quotes for variety
      this.codingQuotes = this.shuffleArray([...this.codingQuotes]).slice(0, 5);
    }
  }

  // Helper method to shuffle an array (Fisher-Yates algorithm)
  private shuffleArray(array: any[]): any[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}