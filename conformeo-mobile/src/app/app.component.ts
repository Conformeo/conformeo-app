import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { 
  IonApp, IonSplitPane, IonMenu, IonContent, IonList, 
  IonListHeader, IonNote, IonItem, IonLabel, 
  IonRouterOutlet, IonIcon, ToastController, MenuController,
  NavController, 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  gridOutline, hammerOutline, mapOutline, peopleOutline, 
  settingsOutline, logOutOutline, sync, checkmarkCircle, warning, calendarOutline
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
    IonRouterOutlet, IonIcon
  ],
})
export class AppComponent {
  
  public appPages = [
    { title: 'Tableau de Bord', url: '/dashboard', icon: 'grid-outline' },
    { title: 'Mes Chantiers', url: '/home', icon: 'map-outline' },
    { title: 'Parc Matériel', url: '/materiel', icon: 'hammer-outline' },
    { title: 'Équipes', url: '/equipe', icon: 'people-outline' }, // Mis à jour
    { title: 'Mon Compte', url: '/settings', icon: 'settings-outline' }, // Mis à jour
    { title: 'Planning', url: '/planning', icon: 'calendar-outline' }, // Mis à jour
  ];

  currentUrl = '';

  constructor(
    private offline: OfflineService,
    private api: ApiService,
    private toastCtrl: ToastController,
    private http: HttpClient,
    private router: Router,
    private menuCtrl: MenuController,
    private navCtrl: NavController
  ) {
    addIcons({ 
      gridOutline, hammerOutline, mapOutline, peopleOutline, 
      settingsOutline, logOutOutline, sync, checkmarkCircle, warning, calendarOutline
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
        // On attend un peu que le token soit chargé (au cas où)
        setTimeout(() => {
            this.processQueue();
        }, 2000);
      }
    });
  }

  navigateTo(url: string) {
    this.navCtrl.navigateRoot(url, { animated: false });
    this.menuCtrl.close();
  }

  isUrlActive(url: string): boolean {
    return this.currentUrl === url || this.currentUrl.startsWith(url);
  }

  logout() {
    this.api.logout();
  }

  // --- ROBOT DE SYNCHRONISATION (CORRIGÉ) ---
  async processQueue() {
    const queue = await this.offline.getQueue();
    
    if (queue.length === 0) return;

    // On vérifie qu'on est connecté avant de synchroniser
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

    console.log("Traitement file d'attente...", queue);

    for (const action of queue) {
      
      // CAS 1 : Chantier (Utilise ApiService qui ajoute le Token)
      if (action.type === 'POST_CHANTIER') {
        this.api.createChantier(action.data).subscribe({
            error: (e) => console.error("Erreur Chantier", e)
        });
      }

      // CAS 2 : Matériel
      else if (action.type === 'POST_MATERIEL') {
        this.api.createMateriel(action.data).subscribe({
            error: (e) => console.error("Erreur Matériel", e)
        });
      }

      // CAS 3 : Photo Unique (Utilise createRapport de ApiService)
      else if (action.type === 'POST_RAPPORT_PHOTO') {
        const data = action.data; 
        try {
          const rawPath = data.localPhotoPath;
          const fileName = rawPath.substring(rawPath.lastIndexOf('/') + 1);
          const blob = await this.api.readLocalPhoto(fileName);

          // Upload (Public)
          this.api.uploadPhoto(blob).subscribe({
            next: (res) => {
               // Création Rapport (Sécurisé par ApiService)
               this.api.createRapport(data.rapport, res.url).subscribe();
            }
          });
        } catch (e) {}
      }

      // CAS 4 : Galerie Multi-Photos (CORRECTION ICI)
      else if (action.type === 'POST_RAPPORT_MULTI') {
        const data = action.data;
        
        try {
          console.log(`📸 Traitement multi-photos (${data.localPaths.length})...`);
          
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

          // On met à jour les URLs dans l'objet rapport
          data.rapport.image_urls = cloudUrls;

          // 👇 C'EST ICI LE CHANGEMENT CRITIQUE
          // Au lieu de this.http.post (qui oubliait le token), 
          // on utilise la méthode du service qui injecte le token !
          this.api.createRapport(data.rapport).subscribe({
             next: () => {
                this.toastCtrl.create({
                  message: `✅ Une photo a été synchronisée !`,
                  duration: 2000,
                  color: 'success',
                  position: 'top',
                  icon: 'checkmark-circle'
                }).then(t => t.present());
             },
             error: (err) => console.error("Erreur envoi rapport sync", err)
          });

        } catch (e) {
          console.error("❌ Erreur synchro multi", e);
        }
      }
    }

    await this.offline.clearQueue();
  }
}