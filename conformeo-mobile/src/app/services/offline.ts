import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { Network } from '@capacitor/network';
import { BehaviorSubject } from 'rxjs';

export interface StoredAction {
  id: string;
  type: 'POST_CHANTIER' | 'POST_MATERIEL'; // On pourra en ajouter d'autres
  data: any;
  time: number;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineService {
  private _storage: Storage | null = null;
  
  // Un "Subject" est une variable observable que l'app peut écouter en temps réel
  public isOnline = new BehaviorSubject<boolean>(true);

  constructor(private storage: Storage) {
    this.init();
    this.listenToNetwork();
  }

  // 1. Initialiser la Base de Données
  async init() {
    const storage = await this.storage.create();
    this._storage = storage;
    
    // Vérifier le statut réseau au démarrage
    const status = await Network.getStatus();
    this.isOnline.next(status.connected);
  }

  // 2. Écouter les changements de réseau (4G <-> Coupure)
  listenToNetwork() {
    Network.addListener('networkStatusChange', status => {
      console.log('Changement réseau :', status.connected ? 'EN LIGNE' : 'HORS LIGNE');
      this.isOnline.next(status.connected);
    });
  }

  // 1. Ajouter une action dans la file d'attente
  async addToQueue(actionType: 'POST_CHANTIER' | 'POST_MATERIEL', payload: any) {
    const action: StoredAction = {
      id: Math.random().toString(36).substring(2), // ID unique temporaire
      type: actionType,
      data: payload,
      time: Date.now()
    };

    // On récupère la liste actuelle
    let queue: StoredAction[] = await this.get('action_queue') || [];
    queue.push(action);
    
    // On sauvegarde
    await this.set('action_queue', queue);
    console.log('📦 Action ajoutée à la file d\'attente :', action);
    return action; // On retourne l'action pour simuler une réussite
  }

  // 2. Récupérer toute la file
  async getQueue(): Promise<StoredAction[]> {
    return await this.get('action_queue') || [];
  }

  // 3. Vider la file (après synchro réussie)
  async clearQueue() {
    await this.set('action_queue', []);
  }


  // 3. Méthodes pour stocker des données (Le Coffre-fort)
  public async set(key: string, value: any) {
    await this._storage?.set(key, value);
  }

  public async get(key: string) {
    return await this._storage?.get(key);
  }
}