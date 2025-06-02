import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'converter',
    loadComponent: () => import('./features/converter/converter.page').then(m => m.ConverterPage)
  },
  {
    path: 'history',
    loadComponent: () => import('./features/history/history.page').then(m => m.HistoryPage)
  },
  {
    path: 'graph',
    loadComponent: () => import('./features/graph/graph.page').then(m => m.GraphPage)
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.page').then(m => m.SettingsPage)
  },
  {
    path: '',
    redirectTo: 'converter',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
