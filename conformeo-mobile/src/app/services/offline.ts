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
}