import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ToastrService } from 'ngx-toastr';
import { Observable, map, of, take } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {

  constructor(
    private authService: AuthService, 
    private router: Router,
    private toastr: ToastrService
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    // First check if user is logged in
    if (!this.authService.isLoggedInGuard) {
      this.toastr.warning("You need to log in first", undefined, {
        timeOut: 2000, 
      }); 
      this.router.navigate(['/auth']);
      return of(false);
    }

    // Then check if user is admin
    return this.authService.isAdmin().pipe(
      take(1),
      map(isAdmin => {
        if (isAdmin) {
          console.log('Admin access granted');
          return true;
        } else {
          console.log('Admin access denied');
          this.toastr.error("Admin access required", undefined, {
            timeOut: 2000, 
          });
          this.router.navigate(['/dashboard']);
          return false;
        }
      })
    );
  }
} 