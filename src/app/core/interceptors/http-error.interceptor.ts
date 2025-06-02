import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NotificationsService } from '../services/notifications.service';
import { NetworkService } from '../services/network.service';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  constructor(
    private notificationsService: NotificationsService,
    private networkService: NetworkService
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = this.getErrorMessage(error);
        this.handleError(error, errorMessage);
        return throwError(() => error);
      })
    );
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      return `Client Error: ${error.error.message}`;
    }

    // Server-side error
    switch (error.status) {
      case 0:
        return 'Unable to connect to the server. Please check your internet connection.';
      case 400:
        return 'Bad Request: The request was invalid.';
      case 401:
        return 'Unauthorized: Please authenticate to access this resource.';
      case 403:
        return 'Forbidden: You don\'t have permission to access this resource.';
      case 404:
        return 'Not Found: The requested resource does not exist.';
      case 408:
        return 'Request Timeout: The server took too long to respond.';
      case 429:
        return 'Too Many Requests: Please wait before making more requests.';
      case 500:
        return 'Internal Server Error: Something went wrong on our servers.';
      case 502:
        return 'Bad Gateway: The server received an invalid response.';
      case 503:
        return 'Service Unavailable: The server is temporarily unavailable.';
      case 504:
        return 'Gateway Timeout: The server took too long to respond.';
      default:
        return `Server Error: ${error.message}`;
    }
  }

  private async handleError(error: HttpErrorResponse, message: string): Promise<void> {
    // Log error
    console.error('HTTP Error:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      message: error.message,
      error: error.error
    });

    // Check if error is due to network connectivity
    const isConnected = await this.networkService.getCurrentNetworkStatus();
    if (!isConnected && error.status === 0) {
      message = 'No internet connection. Please check your network settings.';
    }

    // Show notification to user
    await this.notificationsService.sendCustomNotification(
      'Error',
      message
    );

    // Additional error handling based on status codes
    if (error.status === 401) {
      // Handle authentication errors
      // You might want to redirect to login or refresh tokens
      console.warn('Authentication error detected');
    } else if (error.status === 403) {
      // Handle authorization errors
      console.warn('Authorization error detected');
    } else if (error.status === 429) {
      // Handle rate limiting
      const retryAfter = error.headers.get('Retry-After');
      if (retryAfter) {
        console.warn(`Rate limited. Retry after ${retryAfter} seconds`);
      }
    }
  }
} 