import { EventEmitter, Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SharedScrollService {

  constructor() { }

  scrollToFeature: EventEmitter<void> = new EventEmitter<void>();
  scrollLetestSection: EventEmitter<void> = new EventEmitter<void>();

  emitScrollEvent() {
    this.scrollToFeature.emit();
  }

  goToLetestSection(){
    this.scrollLetestSection.emit();
  }
  
}
