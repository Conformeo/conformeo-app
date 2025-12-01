import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet, ToastController } from '@ionic/angular/standalone';
import { OfflineService } from './services/offline';
import { ApiService } from './services/api';
import { HttpClient } from '@angular/common/http'; // Ajout pour l'envoi final

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

    // Notification de début
    const toastStart = await this.toastCtrl.create({
      message: `🔄 Réseau retrouvé : Envoi de ${queue.length} élément(s)...`,
      duration: 3000,
      position: 'top',
      color: 'warning'
    });
    toastStart.present();

    console.log("Traitement file d'attente...", queue);

    for (const action of queue) {
      
      // CAS 1 : Chantier Texte
      if (action.type === 'POST_CHANTIER') {
        this.api.createChantier(action.data).subscribe();
      }

      // CAS 2 : Matériel
      else if (action.type === 'POST_MATERIEL') {
        this.api.createMateriel(action.data).subscribe();
      }

      // CAS 3 : Photo Unique (Ancien Tunnel)
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

      // CAS 4 : Galerie Multi-Photos (Le Super Tunnel) 📸📸
      else if (action.type === 'POST_RAPPORT_MULTI') {
        const data = action.data; // { rapport, localPaths: string[] }
        
        try {
          console.log(`📸 Traitement multi-photos (${data.localPaths.length})...`);
          
          // A. Lire tous les fichiers locaux
          const blobPromises = data.localPaths.map((path: string) => {
             const fileName = path.substring(path.lastIndexOf('/') + 1);
             return this.api.readLocalPhoto(fileName);
          });
          const blobs = await Promise.all(blobPromises);

          // B. Uploader tout sur Cloudinary
          const uploadPromises = blobs.map((blob: Blob) => 
            new Promise<string>((resolve, reject) => {
              this.api.uploadPhoto(blob).subscribe({
                next: (res) => resolve(res.url),
                error: (err) => reject(err)
              });
            })
          );
          const cloudUrls = await Promise.all(uploadPromises);

          // C. Mettre à jour le rapport avec les URLs
          data.rapport.image_urls = cloudUrls;

          // D. Envoyer le rapport final (On utilise http direct pour éviter les boucles)
          // Attention : Remplace l'URL ci-dessous par la tienne si elle change
          const API_URL = 'https://conformeo-api.onrender.com'; 
          
          this.http.post(`${API_URL}/rapports`, data.rapport).subscribe({
             next: () => {
                this.toastCtrl.create({
                  message: `✅ Galerie photo synchronisée !`,
                  duration: 3000,
                  color: 'success',
                  position: 'top'
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