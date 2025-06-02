import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NotificationsService } from './core/services/notifications.service';
import { SettingsStateService } from './state/settings.state';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterLink, RouterLinkActive]
})
export class AppComponent implements OnInit {
  constructor(
    private notificationsService: NotificationsService,
    private settingsState: SettingsStateService
  ) {}

  async ngOnInit() {
    // Initialize dark mode from settings
    const settings = await this.settingsState.getSettingsSnapshot();
    if (settings.darkMode) {
      document.body.classList.add('dark');
    }
  }
}
