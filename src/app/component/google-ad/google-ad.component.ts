import { Component, OnInit, AfterViewInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

/**
 * GoogleAdComponent - A reusable component for displaying Google AdSense ads
 * 
 * ===== COMPLETE GOOGLE ADSENSE IMPLEMENTATION GUIDE =====
 * 
 * STEP 1: Sign up for Google AdSense
 * - Go to https://www.google.com/adsense/start/
 * - Complete the sign-up process with your website information
 * - Add your website URL during the sign-up process
 * - Wait for approval (typically 1-3 days, but can be longer)
 * 
 * STEP 2: Add the AdSense verification code to your site
 * - After initial sign-up, Google will provide an AdSense code
 * - Add this code to your site's <head> section or use a plugin
 * - Verify your site is accessible to Google's crawlers
 * 
 * STEP 3: Create Ad Units in AdSense dashboard
 * - Log in to your AdSense account after approval
 * - Go to "Ads" > "By ad unit" > "Create new ad unit"
 * - Choose the ad type (display, in-article, in-feed, etc.)
 * - Name your ad unit descriptively (e.g., "Homepage Banner", "Sidebar Ad")
 * - Save to get your ad unit ID (a string starting with "ca-pub-")
 * 
 * STEP 4: Update this component with your Publisher ID and Ad Slot IDs
 * - Replace the placeholder values below with your actual Publisher ID and Ad Slot ID
 * - Consider using environment variables for these sensitive values
 * - Different ad placements should use different ad slots
 * 
 * STEP 5: Add the ads to your Angular application
 * - For regular content ads: <app-google-ad></app-google-ad>
 * - For sidebar ads: <app-google-ad [isSidebar]="true"></app-google-ad>
 * - For custom-sized ads: <app-google-ad [width]="'300px'" [height]="'250px'"></app-google-ad>
 * 
 * STEP 6: Test and verify ads are displaying correctly
 * - Visit your site in a browser (not logged into your Google account)
 * - You should see either real ads or "Ads by Google" placeholder ads
 * - Check the AdSense dashboard for impression and revenue data
 * - If no ads appear, check browser console for errors
 * 
 * IMPORTANT ADSENSE POLICIES:
 * 1. Do NOT click on your own ads - this violates AdSense policies
 * 2. Don't place more than 3 ad units per page
 * 3. Don't place ads too close to navigation elements
 * 4. Ensure your site has substantial content that complies with AdSense policies
 * 5. Don't encourage users to click on your ads
 * 6. Make sure ads are clearly distinguishable from your content
 * 
 * TROUBLESHOOTING:
 * - If ads don't appear, check your AdSense dashboard for policy violations
 * - Make sure the ad client and slot IDs are correct
 * - Check browser console for JavaScript errors
 * - New AdSense accounts may take time to show real ads (up to 2 weeks)
 * - Use AdSense's "Ad review center" to check for rejected ads
 */
@Component({
  selector: 'app-google-ad',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ad-container" 
         [class.sidebar-ad]="isSidebar"
         [style.width]="width" 
         [style.height]="height">
      <ins class="adsbygoogle"
           style="display:block"
           [attr.data-ad-client]="adClient"
           [attr.data-ad-slot]="adSlot"
           [attr.data-ad-format]="adFormat"
           [attr.data-full-width-responsive]="fullWidthResponsive ? 'true' : 'false'">
      </ins>
      <!-- During development or when ads aren't loaded, show this placeholder -->
      <div class="ad-placeholder">
        <span>Advertisement</span>
      </div>
    </div>
  `,
  styles: [`
    .ad-container {
      margin: 20px 0;
      text-align: center;
      min-height: 100px;
      background: #f8f9fa;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .sidebar-ad {
      margin: 10px 0;
      min-height: 250px;
    }
    .ad-placeholder {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #f8f9fa;
      color: #6c757d;
      font-size: 14px;
      z-index: -1;
    }
  `]
})
export class GoogleAdComponent implements OnInit, AfterViewInit {
  // Replace these with your actual Google AdSense details
  @Input() adClient: string = 'ca-pub-YOUR_PUBLISHER_ID'; // Replace with your AdSense publisher ID
  @Input() adSlot: string = 'YOUR_AD_SLOT_ID'; // Replace with your AdSense ad slot ID
  
  // Ad customization options
  @Input() isSidebar: boolean = false;
  @Input() width: string = 'auto';
  @Input() height: string = 'auto';
  @Input() adFormat: string = 'auto'; // options: 'auto', 'horizontal', 'vertical', 'rectangle'
  @Input() fullWidthResponsive: boolean = true;

  constructor() { }

  ngOnInit() {
    // Load the AdSense script if it's not already loaded
    if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + this.adClient;
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }
    
    // Adjust dimensions based on ad format if not explicitly set
    if (this.width === 'auto' && this.height === 'auto') {
      switch (this.adFormat) {
        case 'horizontal':
          this.width = '728px';
          this.height = '90px';
          break;
        case 'vertical':
          this.width = '160px';
          this.height = '600px';
          break;
        case 'rectangle':
          this.width = '336px';
          this.height = '280px';
          break;
        // For 'auto', we keep the dimensions as is
      }
    }
  }

  ngAfterViewInit() {
    // Initialize ads after view is initialized
    setTimeout(() => {
      try {
        // Push the ad to Google AdSense for display
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (error) {
        console.error('Error initializing AdSense:', error);
      }
    }, 100); // Small delay to ensure the DOM is ready
  }
}
