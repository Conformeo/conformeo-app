import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet, ToastController } from '@ionic/angular/standalone';
import { OfflineService } from './services/offline';
import { ApiService } from './services/api';
import { HttpClient } from '@angular/common/http';

// 👇 1. IMPORTS DES ICÔNES
import { addIcons } from 'ionicons';
import { sync, checkmarkCircle, warning } from 'ionicons/icons';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  
  constructor(
    private offline: OfflineService,
    private api: ApiService,
    private toastCtrl: ToastController,
    private http: HttpClient
  ) {
    // 👇 2. ENREGISTREMENT DES ICÔNES
    // C'est ça qui permet au Toast de les afficher
    addIcons({ sync, checkmarkCircle, warning });

    this.initializeApp();
  }

  initializeApp() {
    this.offline.isOnline.subscribe(isOnline => {
      if (isOnline) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    const queue = await this.offline.getQueue();
    
    if (queue.length === 0) return;

    const toastStart = await this.toastCtrl.create({
      message: `🔄 Connexion retrouvée : Synchronisation de ${queue.length} élément(s)...`,
      duration: 3000,
      position: 'top',
      color: 'warning',
      icon: 'sync' // <--- Maintenant il la trouvera !
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
        // ... (code inchangé)
      }

      // CAS 4 : Galerie Multi-Photos
      else if (action.type === 'POST_RAPPORT_MULTI') {
        const data = action.data; 
        
        try {
          // A. Lecture locale
          const blobPromises = data.localPaths.map((path: string) => {
             const fileName = path.substring(path.lastIndexOf('/') + 1);
             return this.api.readLocalPhoto(fileName);
          });
          const blobs = await Promise.all(blobPromises);

          // B. Upload Cloudinary
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
          const API_URL = 'https://conformeo-api.onrender.com'; 
          
          this.http.post(`${API_URL}/rapports`, data.rapport).subscribe({
             next: () => {
                this.toastCtrl.create({
                  message: `✅ Galerie photo synchronisée !`,
                  duration: 3000,
                  color: 'success',
                  position: 'top',
                  icon: 'checkmark-circle' // <--- Il la trouvera aussi !
                }).then(t => t.present());
             }
          });

        } catch (e) {
          console.error("❌ Erreur synchro multi", e);
        }
      }
    }

    await this.offline.clearQueue();
  }
}