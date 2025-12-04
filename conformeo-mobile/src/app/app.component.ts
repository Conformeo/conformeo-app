import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd, RouterLink, RouterLinkActive} from '@angular/router';
import { 
  IonApp, IonSplitPane, IonMenu, IonContent, IonList, 
  IonItem, IonLabel, IonMenuToggle,
  IonRouterOutlet, IonIcon, ToastController, MenuController,
  NavController // <--- 1. AJOUTER L'IMPORT
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
    RouterLink,       // <--- 2. AJOUTEZ CECI
    RouterLinkActive,
    IonApp, IonSplitPane, IonMenu, IonContent, IonList, 
    IonItem, IonLabel, IonMenuToggle,
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
    private menuCtrl: MenuController,
    private navCtrl: NavController // <--- 2. INJECTION DU NAV CONTROLLER
  ) {
    addIcons({ 
      gridOutline, hammerOutline, mapOutline, peopleOutline, 
      settingsOutline, logOutOutline, sync, checkmarkCircle, warning 
    });
    
    this.initializeApp();

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentUrl = event.url;
      }
    });
  }

  initializeApp() {
    this.offline.isOnline.subscribe(isOnline => {
      if (isOnline) {
        this.processQueue();
      }
    });
  }

  // --- NAVIGATION ROBUSTE ---
  navigateTo(url: string) {
    // 3. ON UTILISE navCtrl AU LIEU DE router
    this.navCtrl.navigateRoot(url, { animated: false });
    
    // On ferme le menu (utile sur Mobile, ignoré sur Desktop Split Pane)
    this.menuCtrl.close();
  }

  isUrlActive(url: string): boolean {
    return this.currentUrl === url || this.currentUrl.startsWith(url);
  }

  logout() {
    console.log("Déconnexion...");
  }

  async processQueue() {
    const queue = await this.offline.getQueue();
    
    if (queue.length === 0) return;

    const toastStart = await this.toastCtrl.create({
      message: `🔄 Connexion retrouvée : Synchronisation de ${queue.length} élément(s)...`,
      duration: 3000,
      position: 'top',
      color: 'warning',
      icon: 'sync'
    });
    toastStart.present();

    console.log("Traitement file d'attente...", queue);

    for (const action of queue) {
      if (action.type === 'POST_CHANTIER') {
        this.api.createChantier(action.data).subscribe({
            error: (e) => console.error("Erreur Chantier", e)
        });
      }
      else if (action.type === 'POST_MATERIEL') {
        this.api.createMateriel(action.data).subscribe({
            error: (e) => console.error("Erreur Matériel", e)
        });
      }
      else if (action.type === 'POST_RAPPORT_PHOTO') {
         const data = action.data; 
         try {
            const rawPath = data.localPhotoPath;
            const fileName = rawPath.substring(rawPath.lastIndexOf('/') + 1);
            const blob = await this.api.readLocalPhoto(fileName);
            this.api.uploadPhoto(blob).subscribe({
              next: (res) => {
                 this.api.createRapport(data.rapport, res.url).subscribe();
              }
            });
         } catch(e) {}
      }
      else if (action.type === 'POST_RAPPORT_MULTI') {
        const data = action.data;
        try {
          const blobPromises = data.localPaths.map((path: string) => {
             const fileName = path.substring(path.lastIndexOf('/') + 1);
             return this.api.readLocalPhoto(fileName);
          });
          const blobs = await Promise.all(blobPromises);
          const uploadPromises = blobs.map((blob: Blob) => 
            new Promise<string>((resolve, reject) => {
              this.api.uploadPhoto(blob).subscribe({ next: (res) => resolve(res.url), error: reject });
            })
          );
          const cloudUrls = await Promise.all(uploadPromises);
          data.rapport.image_urls = cloudUrls;
          
          const API_URL = 'https://conformeo-api.onrender.com'; 
          this.http.post(`${API_URL}/rapports`, data.rapport).subscribe({
             next: () => {
                this.toastCtrl.create({
                  message: `✅ Galerie photo synchronisée !`,
                  duration: 3000,
                  color: 'success',
                  position: 'top',
                  icon: 'checkmark-circle'
                }).then(t => t.present());
             }
          });
        } catch (e) { console.error("Erreur synchro multi", e); }
      }
    }
    await this.offline.clearQueue();
  }
}