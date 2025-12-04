import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { 
  IonApp, IonSplitPane, IonMenu, IonContent, IonList, 
  IonMenuToggle, IonItem, IonLabel, 
  IonRouterOutlet, IonIcon, ToastController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  gridOutline, hammerOutline, mapOutline, peopleOutline, 
  settingsOutline, logOutOutline, sync, checkmarkCircle, warning 
} from 'ionicons/icons';

import { NavController } from '@ionic/angular/standalone';
import { OfflineService } from './services/offline';
import { ApiService } from './services/api';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
    CommonModule, RouterLink, RouterLinkActive,
    IonApp, IonSplitPane, IonMenu, IonContent, IonList, IonMenuToggle, IonItem, IonLabel, 
    IonRouterOutlet, IonIcon
  ],
})
export class AppComponent {
  
  // MENU LATÉRAL (Pour le Desktop)
  public appPages = [
    { title: 'Tableau de Bord', url: '/dashboard', icon: 'grid-outline' },
    { title: 'Mes Chantiers', url: '/home', icon: 'map-outline' },
    { title: 'Parc Matériel', url: '/materiel', icon: 'hammer-outline' },
    { title: 'Équipes', url: '/home', icon: 'people-outline' },
    { title: 'Paramètres', url: '/home', icon: 'settings-outline' },
  ];

  constructor(
    private offline: OfflineService,
    private api: ApiService,
    private toastCtrl: ToastController,
    private http: HttpClient,
    private navCtrl: NavController,
  ) {
    // On enregistre TOUTES les icônes (Menu + Notifs)
    addIcons({ 
      gridOutline, hammerOutline, mapOutline, peopleOutline, 
      settingsOutline, logOutOutline, sync, checkmarkCircle, warning 
    });
    
    this.initializeApp();
  }

  initializeApp() {
    this.offline.isOnline.subscribe(isOnline => {
      if (isOnline) {
        this.processQueue();
      }
    });
  }
  
  navigateTo(url: string) {
    this.navCtrl.navigateRoot(url, { animated: false }); // Force la navigation sans animation
  }

  // --- ROBOT DE SYNCHRONISATION ---
  async processQueue() {
    const queue = await this.offline.getQueue();
    
    if (queue.length === 0) return;

    // Notification de démarrage
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
      
      // CAS 1 : Chantier Texte
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

      // CAS 3 : Photo Unique
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
        } catch (e) { console.error("Erreur photo unique", e); }
      }

      // CAS 4 : Galerie Multi-Photos (Le Super Tunnel)
      else if (action.type === 'POST_RAPPORT_MULTI') {
        const data = action.data; // { rapport, localPaths: string[] }
        
        try {
          console.log(`📸 Traitement multi-photos (${data.localPaths.length})...`);
          
          // A. Lecture locale des fichiers
          const blobPromises = data.localPaths.map((path: string) => {
             const fileName = path.substring(path.lastIndexOf('/') + 1);
             return this.api.readLocalPhoto(fileName);
          });
          const blobs = await Promise.all(blobPromises);

          // B. Upload Cloudinary en parallèle
          const uploadPromises = blobs.map((blob: Blob) => 
            new Promise<string>((resolve, reject) => {
              this.api.uploadPhoto(blob).subscribe({
                next: (res) => resolve(res.url),
                error: (err) => reject(err)
              });
            })
          );
          const cloudUrls = await Promise.all(uploadPromises);

          // C. Mise à jour rapport
          data.rapport.image_urls = cloudUrls;

          // D. Envoi final
          // On utilise l'URL de prod directement pour être sûr
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

        } catch (e) {
          console.error("❌ Erreur synchro multi", e);
        }
      }
    }

    // Une fois fini, on vide la file
    await this.offline.clearQueue();
  }


}