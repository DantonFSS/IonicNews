import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { retryWhen, mergeMap } from 'rxjs/operators';
import { SettingsStateService } from '../../state/settings.state';
import { NotificationsService } from '../services/notifications.service';

export interface RetryConfig {
  maxRetries: number;
  backoffInterval: number;
  maxBackoffInterval: number;
  excludedStatusCodes: number[];
}

@Injectable()
export class RetryInterceptor implements HttpInterceptor {
  private readonly DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 3,
    backoffInterval: 1000, // Initial retry delay in milliseconds
    maxBackoffInterval: 10000, // Maximum retry delay
    excludedStatusCodes: [400, 401, 403, 404] // Don't retry these status codes
  };

  constructor(
    private settingsState: SettingsStateService,
    private notificationsService: NotificationsService
  ) {}

  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      retryWhen(errors => 
        errors.pipe(
          mergeMap((error, index) => {
            const retryAttempt = index + 1;

            // Don't retry if it's not an HTTP error or if it's an excluded status code
            if (
              !(error instanceof HttpErrorResponse) ||
              this.DEFAULT_CONFIG.excludedStatusCodes.includes(error.status) ||
              retryAttempt > this.DEFAULT_CONFIG.maxRetries
            ) {
              return throwError(() => error);
            }

            // Calculate exponential backoff delay
            const delay = Math.min(
              this.DEFAULT_CONFIG.backoffInterval * Math.pow(2, retryAttempt - 1),
              this.DEFAULT_CONFIG.maxBackoffInterval
            );

            // Notify user about retry attempt
            this.notifyRetry(error, retryAttempt, delay);

            // Retry after delay
            return timer(delay);
          })
        )
      )
    );
  }

  private async notifyRetry(error: HttpErrorResponse, attempt: number, delay: number): Promise<void> {
    const message = `Request failed: ${error.message}. Retrying in ${delay / 1000} seconds (Attempt ${attempt}/${this.DEFAULT_CONFIG.maxRetries})`;
    
    await this.notificationsService.sendCustomNotification(
      'Request Retry',
      message
    );

    console.warn(`Retry attempt ${attempt}:`, {
      error: error.message,
      status: error.status,
      delay: `${delay}ms`,
      url: error.url
    });
  }
} 