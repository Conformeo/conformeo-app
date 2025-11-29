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
    
    if (queue.length === 0) return; // Rien à faire

    console.log(`🔄 Connexion retrouvée ! Synchronisation de ${queue.length} actions...`);
    
    // On présente un petit message
    const toast = await this.toastCtrl.create({
      message: 'Connexion retrouvée : Synchronisation en cours...',
      duration: 3000,
      position: 'top',
      color: 'primary'
    });
    toast.present();

    // On traite les éléments un par un
    for (const action of queue) {
      if (action.type === 'POST_CHANTIER') {
        // On force l'appel HTTP (on ne repasse pas par createChantier pour éviter la boucle)
        // Note: Dans une vraie app, on gérerait les erreurs ici
        this.api.createChantier(action.data).subscribe({
            next: (res) => console.log('✅ Chantier synchronisé :', res.nom),
            error: (err) => console.error('❌ Erreur synchro', err)
        });
      }
    }

    // Une fois fini, on vide la liste
    await this.offline.clearQueue();
  }
}