import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
  HttpResponse
} from '@angular/common/http';
import { Observable, from, throwError, lastValueFrom } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { StorageService } from '../storage/storage.service';
import { SettingsStateService } from '../../state/settings.state';
import { Network } from '@capacitor/network';

@Injectable()
export class OfflineInterceptor implements HttpInterceptor {
  constructor(
    private storage: StorageService,
    private settingsState: SettingsStateService
  ) {}

  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return from(this.handleRequest(request, next));
  }

  private async handleRequest(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Promise<HttpEvent<any>> {
    const settings = await this.settingsState.getSettingsSnapshot();
    const networkStatus = await Network.getStatus();
    const isOffline = !networkStatus.connected || settings.offlineMode;

    if (isOffline) {
      const cachedResponse = await this.getCachedResponse(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      throw new HttpErrorResponse({
        error: 'Offline: No cached data available',
        status: 503,
        statusText: 'Service Unavailable'
      });
    }

    try {
      const response = await lastValueFrom(
        next.handle(request).pipe(
          catchError((error) => {
            if (error instanceof HttpErrorResponse && !networkStatus.connected) {
              return from(this.getCachedResponse(request)).pipe(
                switchMap(cachedResponse => {
                  if (cachedResponse) {
                    return from([cachedResponse]);
                  }
                  return throwError(() => error);
                })
              );
            }
            return throwError(() => error);
          })
        )
      );

      // Cache successful responses
      if (response instanceof HttpResponse) {
        const cacheKey = this.getCacheKey(request);
        await this.storage.set(cacheKey, response.body);
      }

      return response;
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        throw error;
      }
      throw new HttpErrorResponse({
        error: 'Network error',
        status: 503,
        statusText: 'Service Unavailable'
      });
    }
  }

  private async getCachedResponse(request: HttpRequest<any>): Promise<HttpEvent<any> | null> {
    const cacheKey = this.getCacheKey(request);
    const cachedData = await this.storage.get(cacheKey);
    
    if (cachedData) {
      return new HttpResponse({
        body: cachedData,
        status: 200,
        statusText: 'OK',
        url: request.url,
        headers: request.headers
      });
    }
    
    return null;
  }

  private getCacheKey(request: HttpRequest<any>): string {
    return `offline_cache_${request.method}_${request.urlWithParams}`;
  }
} 