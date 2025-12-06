import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { 
  IonApp, IonSplitPane, IonMenu, IonContent, IonList, 
  IonItem, IonLabel, 
  IonRouterOutlet, IonIcon, ToastController, MenuController,
  NavController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  gridOutline, hammerOutline, mapOutline, peopleOutline, 
  settingsOutline, logOutOutline, sync, checkmarkCircle, warning 
} from 'ionicons/icons';

import { OfflineService } from './services/offline';
import { ApiService } from './services/api';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonApp, IonSplitPane, IonMenu, IonContent, IonList, 
    IonItem, IonLabel, 
    IonRouterOutlet, IonIcon
  ],
})
export class AppComponent {
  
  public appPages = [
    { title: 'Tableau de Bord', url: '/dashboard', icon: 'grid-outline' },
    { title: 'Mes Chantiers', url: '/home', icon: 'map-outline' },
    { title: 'Parc Matériel', url: '/materiel', icon: 'hammer-outline' },
    { title: 'Équipes', url: '/home', icon: 'people-outline' },
    { title: 'Paramètres', url: '/home', icon: 'settings-outline' },
  ];

  currentUrl = '';

  constructor(
    private offline: OfflineService,
    private api: ApiService,
    private toastCtrl: ToastController,
    private http: HttpClient,
    private router: Router,
    private menuCtrl: MenuController, // Pour fermer le menu
    private navCtrl: NavController
  ) {
    addIcons({ gridOutline, hammerOutline, mapOutline, peopleOutline, settingsOutline, logOutOutline, sync, checkmarkCircle, warning });
    this.initializeApp();
    
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) this.currentUrl = event.url;
    });
  }

  initializeApp() {
    this.offline.isOnline.subscribe(isOnline => {
      if (isOnline) this.processQueue();
    });
  }

 // --- NAVIGATION ROBUSTE (CORRIGÉE) ---
  navigateTo(url: string) {
    // 1. Si on est déjà sur la page, on ne fait rien (évite l'erreur "already activated")
    if (this.router.url === url) {
        return;
    }

    // 2. Navigation standard (plus douce)
    this.router.navigateByUrl(url);
    
    // 3. Fermer le menu (seulement si nécessaire)
    this.menuCtrl.close(); 
  }

  isUrlActive(url: string): boolean {
    return this.currentUrl === url || this.currentUrl.startsWith(url);
  }

  logout() { console.log("Déconnexion..."); }

  async processQueue() {
    // ... (Garder votre code de synchro ici, je ne le recopie pas pour alléger) ...
    // Copiez-collez le contenu de votre ancienne fonction processQueue ici
    const queue = await this.offline.getQueue();
    if (queue.length === 0) return;
    // ... etc ...
  }
}