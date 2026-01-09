import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { 
  IonApp, IonSplitPane, IonMenu, IonContent, IonList, 
  IonListHeader, IonNote, IonItem, IonLabel, 
  IonRouterOutlet, IonIcon, ToastController, MenuController,
  IonMenuToggle // 👈 AJOUT IMPORTANT
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  gridOutline, hammerOutline, mapOutline, peopleOutline, business,
  settingsOutline, logOutOutline, sync, checkmarkCircle, warning, calendarOutline,
  documentTextOutline // Ajout icone doc
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
    RouterLinkActive,
    IonApp, IonSplitPane, IonMenu, IonContent, IonList, 
    IonListHeader, IonNote, IonItem, IonLabel, 
    IonRouterOutlet, IonIcon, IonMenuToggle // 👈 N'oubliez pas de l'ajouter ici
  ],
})
export class AppComponent {
  
  // 👇 MENU MIS À JOUR
  public appPages = [
    { title: 'Tableau de Bord', url: '/home', icon: 'grid-outline' }, // /home contient vos stats et la carte
    { title: 'Mes Chantiers', url: '/chantiers', icon: 'hammer-outline' },
    { title: 'Matériel', url: '/materiels', icon: 'settings-outline' }, // Attention: 'materiel' ou 'materiels' selon vos routes
    { title: 'Mon Équipe', url: '/team', icon: 'people-outline' },
    { title: 'Mon Entreprise', url: '/company', icon: 'business' }, // La nouvelle page fusionnée
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
      documentTextOutline
    });
    
    this.initializeApp();

    // Suivi de l'URL active pour la surbrillance dans le menu
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

  // 👇 FONCTION SUPPRIMÉE : navigateTo() (Plus nécessaire grâce à routerLink dans le HTML)

  isUrlActive(url: string): boolean {
    return this.currentUrl === url || this.currentUrl.startsWith(url);
  }

  logout() {
    this.api.logout();
    this.menuCtrl.close(); // On ferme le menu en partant
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