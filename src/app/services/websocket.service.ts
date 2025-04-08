// websocket.service.ts
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket!: WebSocket;
  public messages = new Subject<any>();
  public serverInfo = new Subject<{http_url: string, websocket_url: string}>();

  constructor() { }

  connect(url: string) {
    this.socket = new WebSocket(url);

    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      // Handle different message types
      if (message.type === 'server_info') {
        this.serverInfo.next({
          http_url: message.http_url,
          websocket_url: message.websocket_url
        });
      } else {
        this.messages.next(message);
      }
    };

    this.socket.onopen = (event) => {
      console.log('WebSocket connected:', event);
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket closed:', event);
    };
  }

  send(message: any) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  disconnect() {
    this.socket.close();
  }
}