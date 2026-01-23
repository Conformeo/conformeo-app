import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { Router, NavigationEnd, RouterLink,  } from '@angular/router';
import { 
  IonApp, IonSplitPane, IonMenu, IonContent, IonList, 
  IonItem, IonLabel, 
  IonRouterOutlet, IonIcon, ToastController, MenuController,
  IonMenuToggle // 👈 IonButton ajouté pour le logout
} from '@ionic/angular/standalone';
import { 
  gridOutline, hammerOutline, mapOutline, peopleOutline, business,
  settingsOutline, logOutOutline, sync, checkmarkCircle, warning, calendarOutline,
  documentTextOutline, home, cubeOutline
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
    RouterLink,       
    IonApp, IonSplitPane, IonMenu, IonContent, IonList, 
    IonItem, IonLabel, 
    IonRouterOutlet, IonIcon, IonMenuToggle 
  ],
})
export class AppComponent {
  
  // 👇 MENU COMPLET
  public appPages = [
    { title: 'Tableau de Bord', url: '/dashboard', icon: 'grid-outline' },
    { title: 'Mes Chantiers', url: '/home', icon: 'map-outline' },
    { title: 'Parc Matériel', url: '/materiel', icon: 'hammer-outline' },
    { title: 'Équipes', url: '/team', icon: 'people-outline' },
    { title: 'Mon Entreprise', url: '/company', icon: 'business' }, // ✅ Page Entreprise
    { title: 'Planning', url: '/planning', icon: 'calendar-outline' },
    { title: 'Mon Compte', url: '/settings', icon: 'settings-outline' },
  ];

  currentUrl = '';

  constructor(
    private offline: OfflineService,
    private api: ApiService,
    private toastCtrl: ToastController,
    private http: HttpClient,
    private router: Router,
    private menuCtrl: MenuController
  ) {
    addIcons({ 
      gridOutline, hammerOutline, mapOutline, peopleOutline, business,
      settingsOutline, logOutOutline, sync, checkmarkCircle, warning, calendarOutline,
      documentTextOutline, home, cubeOutline
    });
    
    this.initializeApp();

    // Suivi de l'URL active pour la surbrillance
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentUrl = event.url;
      }
    });
  }

  initializeApp() {
    this.offline.isOnline.subscribe(isOnline => {
      if (isOnline) {
        setTimeout(() => {
            this.processQueue();
        }, 2000);
      }
    });
  }

  isUrlActive(url: string): boolean {
    return this.currentUrl === url || this.currentUrl.startsWith(url);
  }

  logout() {
    this.api.logout();
    this.menuCtrl.close();
    this.router.navigateByUrl('/login');
  }

  // --- ROBOT DE SYNCHRONISATION ---
  async processQueue() {
    const queue = await this.offline.getQueue();
    
    if (queue.length === 0) return;

    const isAuth = await this.api.isAuthenticated();
    if (!isAuth) {
        console.log("⚠️ Synchro en attente : Utilisateur non connecté");
        return;
    }

    const toastStart = await this.toastCtrl.create({
      message: `🔄 Réseau retrouvé : Envoi de ${queue.length} éléments...`,
      duration: 3000,
      position: 'top',
      color: 'warning',
      icon: 'sync'
    });
    toastStart.present();

    for (const action of queue) {
      
      if (action.type === 'POST_CHANTIER') {
        this.api.createChantier(action.data).subscribe({ error: (e) => console.error(e) });
      }

      else if (action.type === 'POST_MATERIEL') {
        this.api.createMateriel(action.data).subscribe({ error: (e) => console.error(e) });
      }

      else if (action.type === 'POST_RAPPORT_PHOTO') {
        const data = action.data; 
        try {
          const rawPath = data.localPhotoPath;
          const fileName = rawPath.substring(rawPath.lastIndexOf('/') + 1);
          // @ts-ignore - Ignore si la méthode n'existe pas encore dans votre version locale
          const blob = await this.api.readLocalPhoto(fileName);

          this.api.uploadPhoto(blob).subscribe({
            next: (res) => {
               this.api.createRapport(data.rapport, res.url).subscribe();
            }
          });
        } catch (e) {}
      }

      else if (action.type === 'POST_RAPPORT_MULTI') {
        const data = action.data;
        try {
          const blobPromises = data.localPaths.map((path: string) => {
             const fileName = path.substring(path.lastIndexOf('/') + 1);
             // @ts-ignore
             return this.api.readLocalPhoto(fileName);
          });
          const blobs = await Promise.all(blobPromises);

          const uploadPromises = blobs.map((blob: Blob) => 
            new Promise<string>((resolve, reject) => {
              this.api.uploadPhoto(blob).subscribe({
                next: (res) => resolve(res.url),
                error: (err) => reject(err)
              });
            })
          );
          const cloudUrls = await Promise.all(uploadPromises);

          data.rapport.image_urls = cloudUrls;

          this.api.createRapport(data.rapport).subscribe({
             next: () => {
                this.toastCtrl.create({
                  message: `✅ Synchro terminée`,
                  duration: 2000,
                  color: 'success',
                  position: 'top',
                  icon: 'checkmark-circle'
                }).then(t => t.present());
             }
          });

        } catch (e) { console.error(e); }
      }
    }
    await this.offline.clearQueue();
  }
}