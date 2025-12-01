import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { Network } from '@capacitor/network';
import { BehaviorSubject } from 'rxjs';

export interface StoredAction {
  id: string;
  // 👇 AJOUTE 'POST_RAPPORT_PHOTO' ICI
  type: 'POST_CHANTIER' | 'POST_MATERIEL' | 'POST_RAPPORT_PHOTO'; 
  data: any;
  time: number;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineService {
  private _storage: Storage | null = null;
  public isOnline = new BehaviorSubject<boolean>(true);

  constructor(private storage: Storage) {
    this.init();
    this.listenToNetwork();
  }

  async init() {
    const storage = await this.storage.create();
    this._storage = storage;
    const status = await Network.getStatus();
    this.isOnline.next(status.connected);
  }

  listenToNetwork() {
    Network.addListener('networkStatusChange', status => {
      console.log('Changement réseau :', status.connected ? 'EN LIGNE' : 'HORS LIGNE');
      this.isOnline.next(status.connected);
    });
  }

  // 👇 AJOUTE LE TYPE ICI AUSSI DANS LES ARGUMENTS
  async addToQueue(actionType: 'POST_CHANTIER' | 'POST_MATERIEL' | 'POST_RAPPORT_PHOTO', payload: any) {
    const action: StoredAction = {
      id: Math.random().toString(36).substring(2),
      type: actionType,
      data: payload,
      time: Date.now()
    };

    let queue: StoredAction[] = await this.get('action_queue') || [];
    queue.push(action);
    
    await this.set('action_queue', queue);
    console.log('📦 Action ajoutée à la file d\'attente :', action);
    return action;
  }

  public async getQueue(): Promise<StoredAction[]> {
    return await this.get('action_queue') || [];
  }

  async clearQueue() {
    await this.set('action_queue', []);
  }

  public async set(key: string, value: any) {
    await this._storage?.set(key, value);
  }

  public async get(key: string) {
    return await this._storage?.get(key);
  }

  // ... (imports existants)
  // Ajoute ToastController dans le constructeur de OfflineService si besoin, 
  // ou utilise juste alert() pour le debug, c'est plus simple.

  // ... (imports existants)
  // Ajoute ToastController dans le constructeur de OfflineService si besoin, 
  // ou utilise juste alert() pour le debug, c'est plus simple.

  async debugSyncProcess(apiService: any) {
    alert("Démarrage Synchro Manuelle...");
    
    const queue = await this.get('action_queue') || [];
    alert(`File d'attente : ${queue.length} éléments`);

    if (queue.length === 0) return;

    for (const action of queue) {
      alert(`Traitement action : ${action.type}`);

      if (action.type === 'POST_RAPPORT_PHOTO') {
        try {
          const rawPath = action.data.localPhotoPath;
          // NETTOYAGE DU NOM DE FICHIER (C'est souvent là que ça plante)
          const fileName = rawPath.substring(rawPath.lastIndexOf('/') + 1);
          
          alert(`Lecture fichier : ${fileName}`);

          // Lecture via API Service
          const blob = await apiService.readLocalPhoto(fileName);
          alert(`Fichier lu ! Taille : ${blob.size}`);

          // Upload
          alert("Envoi Cloudinary...");
          apiService.uploadPhoto(blob).subscribe({
            next: (res: any) => {
              alert("Upload OK ! Création rapport...");
              apiService.createRapport(action.data.rapport, res.url).subscribe(() => {
                 alert("✅ TOUT EST BON !");
              });
            },
            error: (err: any) => alert("Erreur Upload : " + JSON.stringify(err))
          });

        } catch (e: any) {
          alert("❌ CRASH : " + JSON.stringify(e));
        }
      }
    }
    // On ne vide pas la queue pour pouvoir retester tant que ça marche pas
  }
}