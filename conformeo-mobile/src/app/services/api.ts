import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { tap, switchMap, catchError } from 'rxjs/operators';
import { OfflineService } from './offline'

// --- INTERFACES ---
export interface Chantier {
  id?: number;
  nom: string;
  adresse: string;
  client: string;
  est_actif: boolean;
  signature_url?: string;
}

export interface Rapport {
  id?: number;
  titre: string;
  description: string;
  photo_url?: string;
  chantier_id: number;
  date_creation?: string;
}

export interface Materiel {
  id?: number;
  nom: string;
  reference: string;
  etat: string;
  chantier_id?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // ⚠️ Mets bien TON url Render ici
  private apiUrl = 'https://conformeo-api.onrender.com'; 

  constructor(
    private http: HttpClient,
    private offline: OfflineService
  ) { }

  // ==========================================
  // 🏗️ GESTION DES CHANTIERS (AVEC OFFLINE)
  // ==========================================

  getChantiers(): Observable<Chantier[]> {
    // 1. Si on est EN LIGNE
    if (this.offline.isOnline.value) {
      return this.http.get<Chantier[]>(`${this.apiUrl}/chantiers`).pipe(
        tap(data => {
          // On sauvegarde la copie fraîche dans le coffre
          this.offline.set('chantiers_cache', data);
        })
      );
    } 
    // 2. Si on est HORS LIGNE
    else {
      return from(this.offline.get('chantiers_cache')).pipe(
        switchMap(data => {
          console.log('📦 Lecture cache chantiers');
          return of(data || []); // Renvoie le cache ou liste vide
        })
      );
    }
  }

  createChantier(chantier: Chantier): Observable<Chantier> {
    // 1. HORS LIGNE -> File d'attente
    if (!this.offline.isOnline.value) {
      console.log('📡 Hors ligne : Mise en file d\'attente');
      this.offline.addToQueue('POST_CHANTIER', chantier);
      // Faux succès pour l'UI
      return of({ ...chantier, id: 9999, est_actif: true });
    }
    // 2. EN LIGNE -> Appel serveur
    return this.http.post<Chantier>(`${this.apiUrl}/chantiers`, chantier);
  }

  getChantierById(id: number): Observable<Chantier> {
    // Pour simplifier, on filtre la liste locale (marche online et offline)
    return this.getChantiers().pipe(
      switchMap(chantiers => {
        const found = chantiers.find(c => c.id == id);
        return of(found as Chantier);
      })
    );
  }

  // ==========================================
  // 📸 RAPPORTS & PHOTOS
  // ==========================================

  getRapports(chantierId: number): Observable<Rapport[]> {
    if (this.offline.isOnline.value) {
      return this.http.get<Rapport[]>(`${this.apiUrl}/chantiers/${chantierId}/rapports`).pipe(
        tap(data => this.offline.set(`rapports_${chantierId}`, data))
      );
    } else {
      return from(this.offline.get(`rapports_${chantierId}`)).pipe(
        switchMap(data => of(data || []))
      );
    }
  }

  // Upload Photo (Vers Cloudinary via Backend)
  uploadPhoto(blob: Blob): Observable<{url: string}> {
    if (!this.offline.isOnline.value) {
      // TODO: Pour la V2, il faudrait stocker le Blob en local
      alert("L'upload de photo nécessite internet pour l'instant.");
      throw new Error("Offline");
    }
    const formData = new FormData();
    formData.append('file', blob, 'photo.jpg');
    return this.http.post<{url: string}>(`${this.apiUrl}/upload`, formData);
  }

  createRapport(rapport: Rapport, photoUrl?: string): Observable<Rapport> {
    let url = `${this.apiUrl}/rapports`;
    if (photoUrl) {
      url += `?photo_url=${encodeURIComponent(photoUrl)}`;
    }
    
    if (!this.offline.isOnline.value) {
        // En mode offline, on ne gère pas encore la création de rapport complexe
        // On pourrait l'ajouter à la queue ici
        return of(rapport); 
    }

    return this.http.post<Rapport>(url, rapport);
  }

  // ==========================================
  // ✍️ SIGNATURE
  // ==========================================

  signChantier(chantierId: number, signatureUrl: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/chantiers/${chantierId}/signature?signature_url=${encodeURIComponent(signatureUrl)}`, {});
  }

  // ==========================================
  // 📊 DASHBOARD & MATERIEL
  // ==========================================

  getDashboardStats(): Observable<any> {
    if(!this.offline.isOnline.value) return of({});
    return this.http.get<any>(`${this.apiUrl}/dashboard/stats`);
  }

  getMateriels(): Observable<Materiel[]> {
    if (this.offline.isOnline.value) {
      return this.http.get<Materiel[]>(`${this.apiUrl}/materiels`).pipe(
        tap(data => this.offline.set('materiels_cache', data))
      );
    } else {
      return from(this.offline.get('materiels_cache')).pipe(switchMap(data => of(data || [])));
    }
  }

  createMateriel(mat: Materiel): Observable<Materiel> {
    return this.http.post<Materiel>(`${this.apiUrl}/materiels`, mat);
  }

  transferMateriel(materielId: number, chantierId: number | null): Observable<any> {
    let url = `${this.apiUrl}/materiels/${materielId}/transfert`;
    if (chantierId) url += `?chantier_id=${chantierId}`;
    return this.http.put(url, {});
  }
}