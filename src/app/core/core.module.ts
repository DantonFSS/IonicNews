import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicStorageModule } from '@ionic/storage-angular';

import { CurrencyService } from './services/currency.service';
import { StorageService } from './storage/storage.service';
import { LoadingService } from './services/loading.service';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    IonicStorageModule.forRoot()
  ],
  providers: [
    CurrencyService,
    StorageService,
    LoadingService
  ]
})
export class CoreModule { } 