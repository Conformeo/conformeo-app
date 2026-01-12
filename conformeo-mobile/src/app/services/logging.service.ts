import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class LoggingInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    console.log('🚀 HTTP REQUEST:', req.method, req.url);
    console.log('   Headers:', req.headers);
    console.log('   Body:', req.body);

    return next.handle(req).pipe(
      tap(
        (event) => {
          console.log('✅ HTTP RESPONSE:', event);
        },
        (error) => {
          console.error('❌ HTTP ERROR:', error);
        }
      )
    );
  }
}
