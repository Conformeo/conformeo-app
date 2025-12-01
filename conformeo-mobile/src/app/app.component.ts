import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet, ToastController } from '@ionic/angular/standalone'; // Ajoute ToastController
import { OfflineService, StoredAction } from './services/offline';
import { ApiService } from './services/api';

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
    private toastCtrl: ToastController
  ) {
    this.initializeApp();
  }

  initializeApp() {
    // On écoute le réseau
    this.offline.isOnline.subscribe(isOnline => {
      if (isOnline) {
        this.processQueue(); // 🚀 Le réseau est là, on envoie tout !
      }
    });
  }

  async processQueue() {
    const queue = await this.offline.getQueue();
    
    if (queue.length === 0) return;

    // 1. On prévient l'utilisateur qu'on travaille
    const toastStart = await this.toastCtrl.create({
      message: `🔄 Réseau retrouvé : Envoi de ${queue.length} éléments...`,
      duration: 2000,
      position: 'top',
      color: 'warning'
    });
    toastStart.present();

    for (const action of queue) {
      
      // CAS 1 : Chantier Texte
      if (action.type === 'POST_CHANTIER') {
        this.api.createChantier(action.data).subscribe();
      }

      // CAS 2 : Photo (Le Tunnel)
      else if (action.type === 'POST_RAPPORT_PHOTO') {
        const data = action.data; // { rapport, localPhotoPath }
        
        try {
          // IMPORTANT : On extrait juste le nom du fichier (ex: "17625252.jpeg")
          // car le chemin complet "file://..." change parfois au redémarrage de l'iPhone
          const rawPath = data.localPhotoPath;
          const fileName = rawPath.substring(rawPath.lastIndexOf('/') + 1);

          console.log("Tentative lecture fichier :", fileName);

          // Lecture
          const blob = await this.api.readLocalPhoto(fileName);

          // Upload Cloudinary
          this.api.uploadPhoto(blob).subscribe({
            next: (res) => {
               // Création Rapport
               this.api.createRapport(data.rapport, res.url).subscribe(async () => {
                  const toastSuccess = await this.toastCtrl.create({
                    message: '✅ Une photo a été synchronisée !',
                    duration: 3000,
                    color: 'success',
                    position: 'top'
                  });
                  toastSuccess.present();
               });
            },
            error: (err) => console.error("Erreur upload Cloudinary", err)
          });

        } catch (e) {
          console.error("❌ Erreur lecture fichier local", e);
          alert("Erreur synchro photo: " + JSON.stringify(e));
        }
      }
    }

    // On vide la file d'attente
    await this.offline.clearQueue();
  }
}