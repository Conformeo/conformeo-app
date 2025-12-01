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

    const toast = await this.toastCtrl.create({
      message: `Synchronisation de ${queue.length} éléments...`,
      duration: 3000,
      position: 'top',
      color: 'primary'
    });
    toast.present();

    for (const action of queue) {
      
      // CAS 1 : Chantier simple (Texte)
      if (action.type === 'POST_CHANTIER') {
        this.api.createChantier(action.data).subscribe();
      }

      // CAS 2 : Rapport avec Photo (Le Tunnel !)
      else if (action.type === 'POST_RAPPORT_PHOTO') {
        const data = action.data; // Contient { rapport, localPhotoPath }
        
        try {
          // 1. On récupère la photo physique dans le téléphone
          // On doit extraire le nom du fichier du chemin complet parfois
          const fileName = data.localPhotoPath.split('/').pop();
          const blob = await this.api.readLocalPhoto(fileName);

          // 2. On l'envoie sur Cloudinary
          this.api.uploadPhoto(blob).subscribe(res => {
             // 3. On crée le rapport final
             this.api.createRapport(data.rapport, res.url).subscribe(() => {
                console.log("📸 Photo synchronisée !");
                // Optionnel : Supprimer le fichier local pour faire de la place
             });
          });

        } catch (e) {
          console.error("Erreur lecture fichier local", e);
        }
      }
    }

    await this.offline.clearQueue();
  }
}