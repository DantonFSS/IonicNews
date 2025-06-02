import { Component, OnInit, OnDestroy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HistoryStateService } from '../../state/history.state';
import { ConversionHistory } from '../../models/currency.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class HistoryPage implements OnInit, OnDestroy {
  conversions: ConversionHistory[] = [];
  searchTerm: string = '';
  sortOrder: 'asc' | 'desc' = 'desc';
  isLoading: boolean = true;
  private destroy$ = new Subject<void>();

  constructor(private historyState: HistoryStateService) {}

  ngOnInit() {
    this.historyState.filteredConversions$
      .pipe(takeUntil(this.destroy$))
      .subscribe(conversions => {
        this.conversions = conversions;
        this.isLoading = false;
      });

    this.historyState.filter$
      .pipe(takeUntil(this.destroy$))
      .subscribe(filter => {
        this.searchTerm = filter || '';
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(event: any) {
    const query = event.target.value.toLowerCase();
    this.historyState.setFilter(query);
  }

  toggleSortOrder() {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    this.historyState.setSortOrder(this.sortOrder);
  }

  async deleteConversion(id: string, event: Event) {
    event.stopPropagation();
    this.historyState.removeConversion(id);
  }

  async clearHistory() {
    const alert = document.createElement('ion-alert');
    alert.header = 'Clear History';
    alert.message = 'Are you sure you want to clear all conversion history?';
    alert.buttons = [
      {
        text: 'Cancel',
        role: 'cancel'
      },
      {
        text: 'Clear',
        role: 'destructive',
        handler: () => {
          this.historyState.clearHistory();
        }
      }
    ];

    document.body.appendChild(alert);
    await alert.present();
  }

  formatDate(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
  }

  async doRefresh(event: any) {
    // Reload the history data
    this.isLoading = true;
    
    // Simulate a delay for better UX
    setTimeout(() => {
      this.isLoading = false;
      event.target.complete();
    }, 1000);
  }
} 