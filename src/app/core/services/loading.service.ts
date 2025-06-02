import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { LoadingController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();
  private activeRequests = 0;
  private loader: HTMLIonLoadingElement | null = null;
  private minLoadingTime = 500; // Minimum time to show loading in ms
  private loadingStartTime: number = 0;

  constructor(private loadingController: LoadingController) {}

  async show() {
    this.activeRequests++;
    if (this.activeRequests === 1) {
      this.loadingStartTime = Date.now();
      this.loadingSubject.next(true);
      
      // Prevent quick flashes of loading for fast requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Only show loading if we still have active requests
      if (this.activeRequests > 0 && !this.loader) {
        this.loader = await this.loadingController.create({
          message: 'Please wait...',
          spinner: 'circular'
        });
        await this.loader.present();
      }
    }
  }

  async hide() {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    
    if (this.activeRequests === 0) {
      this.loadingSubject.next(false);
      
      if (this.loader) {
        // Ensure minimum loading time to prevent flickering
        const elapsedTime = Date.now() - this.loadingStartTime;
        if (elapsedTime < this.minLoadingTime) {
          await new Promise(resolve => setTimeout(resolve, this.minLoadingTime - elapsedTime));
        }
        
        await this.loader.dismiss();
        this.loader = null;
      }
    }
  }

  // Force hide loading in case of errors or edge cases
  async forceHide() {
    this.activeRequests = 0;
    this.loadingSubject.next(false);
    
    if (this.loader) {
      try {
        await this.loader.dismiss();
      } catch (error) {
        console.warn('Error dismissing loader:', error);
      }
      this.loader = null;
    }
  }
} 