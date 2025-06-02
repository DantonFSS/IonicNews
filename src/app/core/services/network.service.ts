import { Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { BehaviorSubject, Observable } from 'rxjs';
import { NotificationsService } from './notifications.service';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private networkStatus = new BehaviorSubject<boolean>(true);
  private lastKnownStatus: boolean = true;

  constructor(private notificationsService: NotificationsService) {
    this.initNetworkListener();
  }

  private async initNetworkListener(): Promise<void> {
    // Get initial network status
    const status = await Network.getStatus();
    this.updateNetworkStatus(status.connected);

    // Listen for network status changes
    Network.addListener('networkStatusChange', (status) => {
      this.updateNetworkStatus(status.connected);
    });
  }

  private async updateNetworkStatus(isConnected: boolean): Promise<void> {
    // Only update and notify if status has changed
    if (this.lastKnownStatus !== isConnected) {
      this.lastKnownStatus = isConnected;
      this.networkStatus.next(isConnected);

      // Notify user of connection status change
      const message = isConnected
        ? 'Network connection restored'
        : 'Network connection lost';
      
      await this.notificationsService.sendCustomNotification(
        'Network Status',
        message
      );

      console.log(`Network status changed: ${isConnected ? 'Online' : 'Offline'}`);
    }
  }

  public getNetworkStatus(): Observable<boolean> {
    return this.networkStatus.asObservable();
  }

  public async getCurrentNetworkStatus(): Promise<boolean> {
    const status = await Network.getStatus();
    return status.connected;
  }

  public async checkConnectivity(): Promise<boolean> {
    try {
      const status = await Network.getStatus();
      return status.connected;
    } catch (error) {
      console.error('Error checking network connectivity:', error);
      return false;
    }
  }

  public async waitForConnection(timeoutMs: number = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      let timeoutId: ReturnType<typeof setTimeout>;
      
      const subscription = this.networkStatus.subscribe((isConnected) => {
        if (isConnected) {
          if (timeoutId) clearTimeout(timeoutId);
          subscription.unsubscribe();
          resolve(true);
        }
      });

      timeoutId = setTimeout(() => {
        subscription.unsubscribe();
        resolve(false);
      }, timeoutMs);
    });
  }
} 