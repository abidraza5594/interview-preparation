import { EventEmitter, Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SharedScrollService {

  constructor() { }

  scrollEvent: EventEmitter<void> = new EventEmitter<void>();
  letestSection: EventEmitter<void> = new EventEmitter<void>();

  emitScrollEvent() {
    this.scrollEvent.emit();
  }

  goToLetestSection(){
    this.letestSection.emit();
  }
  
}
