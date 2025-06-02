import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, ActionSheetController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { CurrencyService } from '../../core/services/currency.service';
import { CurrencyStateService } from '../../state/currency.state';
import { HistoryStateService } from '../../state/history.state';
import { SettingsStateService } from '../../state/settings.state';
import { Currency, ConversionResult, ExchangeRates } from '../../models/currency.model';
import { Subject, combineLatest, firstValueFrom } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-converter',
  templateUrl: './converter.page.html',
  styleUrls: ['./converter.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule]
})
export class ConverterPage implements OnInit, OnDestroy {
  converterForm: FormGroup;
  currencies: Currency[] = [];
  isLoading = false;
  conversionResult: number | null = null;
  errorMessage: string | null = null;
  lastUpdate: string = '';
  private destroy$ = new Subject<void>();
  private autoRefreshInterval: any;

  constructor(
    private formBuilder: FormBuilder,
    private currencyService: CurrencyService,
    private currencyState: CurrencyStateService,
    private historyState: HistoryStateService,
    private settingsState: SettingsStateService,
    private actionSheetCtrl: ActionSheetController
  ) {
    this.converterForm = this.formBuilder.group({
      amount: ['1', [
        Validators.required,
        Validators.min(0.01),
        Validators.pattern('^[0-9]*[.,]?[0-9]*$')
      ]],
      fromCurrency: ['USD', Validators.required],
      toCurrency: ['EUR', Validators.required]
    });
  }

  ngOnInit() {
    this.currencies = this.currencyService.getAvailableCurrencies();
    this.setupFormSubscriptions();
    this.setupStateSubscriptions();
    this.setupAutoRefresh();
    this.loadInitialState();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }
  }

  async openFromCurrencySelect() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Select source currency',
      buttons: this.currencies.map(currency => ({
        text: `${currency.code} - ${currency.name} (${currency.symbol})`,
        handler: () => {
          this.converterForm.patchValue({ fromCurrency: currency.code });
          return true;
        }
      }))
    });
    await actionSheet.present();
  }

  async openToCurrencySelect() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Select target currency',
      buttons: this.currencies.map(currency => ({
        text: `${currency.code} - ${currency.name} (${currency.symbol})`,
        handler: () => {
          this.converterForm.patchValue({ toCurrency: currency.code });
          return true;
        }
      }))
    });
    await actionSheet.present();
  }

  onAmountInput(event: any) {
    let value = event.target.value.toString();
    
    // Replace comma with dot
    value = value.replace(',', '.');
    
    // Remove any characters that aren't numbers or decimal point
    value = value.replace(/[^\d.]/g, '');
    
    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Update the form control with the sanitized value
    this.converterForm.patchValue({ amount: value }, { emitEvent: false });
    
    // Trigger validation
    if (value && Number(value) > 0) {
      this.converterForm.get('amount')?.setErrors(null);
    } else {
      this.converterForm.get('amount')?.setErrors({ min: true });
    }

    // Only perform conversion if the value is valid
    if (this.converterForm.get('amount')?.valid) {
      this.performConversion();
    }
  }

  private setupFormSubscriptions() {
    // Subscribe to currency changes only
    combineLatest([
      this.converterForm.get('fromCurrency')!.valueChanges,
      this.converterForm.get('toCurrency')!.valueChanges
    ]).pipe(
      debounceTime(300),
      distinctUntilChanged((prev, curr) => 
        prev[0] === curr[0] && prev[1] === curr[1]
      ),
      takeUntil(this.destroy$)
    ).subscribe(([fromCurrency, toCurrency]) => {
      this.updateStateFromForm({
        amount: this.converterForm.get('amount')?.value,
        fromCurrency,
        toCurrency
      });
      this.performConversion();
    });
  }

  private setupStateSubscriptions() {
    // Subscribe to currency state changes
    combineLatest([
      this.currencyState.selectedBaseCurrency$,
      this.currencyState.selectedTargetCurrency$,
      this.currencyState.amount$,
      this.currencyState.rates$
    ]).pipe(
      takeUntil(this.destroy$)
    ).subscribe(([base, target, amount, rates]) => {
      if (rates && base && target) {
        const rate = rates.rates[target.code] || 0;
        this.conversionResult = Number((amount * rate).toFixed(2));
        this.lastUpdate = rates.date;
      }
    });

    // Subscribe to loading and error states
    this.currencyState.isLoading$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(loading => {
      this.isLoading = loading;
    });

    this.currencyState.error$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(error => {
      this.errorMessage = error;
    });
  }

  private setupAutoRefresh() {
    this.settingsState.settings$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(settings => {
      if (this.autoRefreshInterval) {
        clearInterval(this.autoRefreshInterval);
      }
      
      if (settings.syncInterval > 0) {
        this.autoRefreshInterval = setInterval(() => {
          this.refreshRates();
        }, settings.syncInterval * 1000);
      }
    });
  }

  private loadInitialState() {
    const state = this.currencyState.getStateSnapshot();
    if (state) {
      this.converterForm.patchValue({
        amount: state.amount.toString(),
        fromCurrency: state.selectedBaseCurrency.code,
        toCurrency: state.selectedTargetCurrency.code
      }, { emitEvent: false });
    }
    
    this.refreshRates();
  }

  private updateStateFromForm(formValue: any) {
    const { amount, fromCurrency, toCurrency } = formValue;
    const numAmount = Number(amount.replace(',', '.'));
    
    if (!isNaN(numAmount)) {
      this.currencyState.setAmount(numAmount);
    }

    const fromCurrencyObj = this.currencies.find(c => c.code === fromCurrency);
    const toCurrencyObj = this.currencies.find(c => c.code === toCurrency);
    
    if (fromCurrencyObj) {
      this.currencyState.setBaseCurrency(fromCurrencyObj);
    }
    if (toCurrencyObj) {
      this.currencyState.setTargetCurrency(toCurrencyObj);
    }
  }

  onSwapCurrencies() {
    const from = this.converterForm.get('fromCurrency')?.value;
    const to = this.converterForm.get('toCurrency')?.value;
    
    this.converterForm.patchValue({
      fromCurrency: to,
      toCurrency: from
    });
  }

  async onConvert() {
    if (this.converterForm.valid) {
      await this.performConversion();
    }
  }

  private async performConversion() {
    if (!this.converterForm.valid) return;

    const { amount, fromCurrency, toCurrency } = this.converterForm.value;
    const numAmount = Number(amount.replace(',', '.'));

    if (isNaN(numAmount) || numAmount <= 0) {
      this.currencyState.setError('Please enter a valid amount');
      return;
    }

    this.currencyState.setLoading(true);
    this.errorMessage = null;

    try {
      const result = await firstValueFrom(this.currencyService.convert(
        numAmount,
        fromCurrency,
        toCurrency
      ));

      if (result) {
        this.saveConversionToHistory(result);
        this.conversionResult = Number(result.result.toFixed(2));
        this.currencyState.setError(null);
      }
    } catch (error) {
      this.currencyState.setError('Failed to convert currency. Please try again.');
      console.error('Conversion error:', error);
    } finally {
      this.currencyState.setLoading(false);
    }
  }

  private saveConversionToHistory(result: ConversionResult) {
    const historyEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      fromCurrency: result.from,
      toCurrency: result.to,
      amount: result.amount,
      convertedAmount: Number(result.result.toFixed(2)),
      rate: result.rate
    };

    this.historyState.addConversion(historyEntry);
  }

  async refreshRates() {
    if (this.isLoading) return;

    this.currencyState.setLoading(true);
    this.errorMessage = null;

    try {
      await this.currencyService.refreshRates();
      this.performConversion();
    } catch (error) {
      this.currencyState.setError('Failed to refresh rates. Please try again.');
      console.error('Refresh error:', error);
    } finally {
      this.currencyState.setLoading(false);
    }
  }
} 