import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet, ToastController } from '@ionic/angular/standalone';
import { OfflineService } from './services/offline';
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
    // On écoute le réseau en permanence
    this.offline.isOnline.subscribe(isOnline => {
      if (isOnline) {
        // Dès que le réseau revient, on lance le traitement
        this.processQueue();
      }
    });
  }

  async processQueue() {
    const queue = await this.offline.getQueue();
    
    // Si rien à faire, on s'arrête
    if (queue.length === 0) return;

    // 1. Notification de début
    const toastStart = await this.toastCtrl.create({
      message: `🔄 Connexion retrouvée : Synchronisation de ${queue.length} élément(s)...`,
      duration: 3000,
      position: 'top',
      color: 'primary',
      icon: 'sync'
    });
    toastStart.present();

    console.log("Traitement de la file d'attente...", queue);

    // 2. Traitement des actions
    for (const action of queue) {
      
      // CAS 1 : Création Chantier (Texte)
      if (action.type === 'POST_CHANTIER') {
        this.api.createChantier(action.data).subscribe({
          next: () => console.log('✅ Chantier synchro'),
          error: (err) => console.error('❌ Erreur synchro chantier', err)
        });
      }

      // CAS 2 : Matériel
      else if (action.type === 'POST_MATERIEL') {
        this.api.createMateriel(action.data).subscribe();
      }

      // CAS 3 : Photo (Le Tunnel Complexe)
      else if (action.type === 'POST_RAPPORT_PHOTO') {
        const data = action.data; // { rapport, localPhotoPath }
        
        try {
          // A. Récupérer le nom du fichier
          const rawPath = data.localPhotoPath;
          const fileName = rawPath.substring(rawPath.lastIndexOf('/') + 1);

          // B. Lire le fichier physique
          const blob = await this.api.readLocalPhoto(fileName);

          // C. Envoyer sur Cloudinary
          this.api.uploadPhoto(blob).subscribe({
            next: (res) => {
               // D. Créer le rapport final avec l'URL Cloudinary
               this.api.createRapport(data.rapport, res.url).subscribe(async () => {
                  
                  // Notification de succès pour chaque photo
                  const toastSuccess = await this.toastCtrl.create({
                    message: '✅ Une photo a été sauvegardée en ligne !',
                    duration: 3000,
                    color: 'success',
                    position: 'top',
                    icon: 'checkmark-circle'
                  });
                  toastSuccess.present();
               });
            },
            error: (err) => console.error("Erreur upload Cloudinary", err)
          });

        } catch (e) {
          console.error("❌ Erreur critique synchro photo", e);
        }
      }
    }

    // 3. Une fois tout lancé, on vide la file d'attente
    // (Dans une V2, on pourrait attendre la réussite de chaque item avant de supprimer)
    await this.offline.clearQueue();
  }
}