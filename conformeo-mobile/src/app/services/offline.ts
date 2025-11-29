import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { Network } from '@capacitor/network';
import { BehaviorSubject } from 'rxjs';

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

  // 3. Méthodes pour stocker des données (Le Coffre-fort)
  public async set(key: string, value: any) {
    await this._storage?.set(key, value);
  }

  public async get(key: string) {
    return await this._storage?.get(key);
  }
}