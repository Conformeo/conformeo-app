import { enableProdMode, importProvidersFrom } from '@angular/core'; // <--- AJOUT importProvidersFrom
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { provideHttpClient, withInterceptors, HTTP_INTERCEPTORS  } from '@angular/common/http';
import { IonicStorageModule } from '@ionic/storage-angular'; // <--- AJOUT IMPORT

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { LoggingInterceptor } from './app/services/logging.service'

import { defineCustomElements } from '@ionic/pwa-elements/loader';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoggingInterceptor,
      multi: true
    },
    // 👇 ON ACTIVE LE STOCKAGE LOCAL ICI
    importProvidersFrom(IonicStorageModule.forRoot()) 
  ],
});

defineCustomElements(window);