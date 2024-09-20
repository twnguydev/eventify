import { NgModule, CUSTOM_ELEMENTS_SCHEMA, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { CacheInterceptor } from '@interceptors/cache.interceptor';
import { NgxIndexedDBModule, DBConfig } from 'ngx-indexed-db';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent } from './app.component';
import { LoginComponent } from '@pages/auth/login/login.component';
import { AppRoutingModule } from './app.routes';
import { CallbackComponent } from '@pages/auth/callback/callback.component';
import { UtcDatePipe } from '@pipes/utc-date.pipe';
import { EventCatalogueComponent } from '@pages/event-catalogue/event-catalogue.component';

const dbConfig: DBConfig = {
  name: 'EventsDB',
  version: 1,
  objectStoresMeta: [{
    store: 'events',
    storeConfig: { keyPath: 'id', autoIncrement: true },
    storeSchema: [
      { name: 'name', keypath: 'name', options: { unique: false } },
      { name: 'date', keypath: 'date', options: { unique: false } },
      { name: 'location', keypath: 'location', options: { unique: false } }
    ]
  }]
};

registerLocaleData(localeFr);

@NgModule({
  declarations: [],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: CacheInterceptor, multi: true },
    { provide: LOCALE_ID, useValue: 'fr-FR' }
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    NgxIndexedDBModule.forRoot(dbConfig),
    ReactiveFormsModule,
    AppRoutingModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule {}