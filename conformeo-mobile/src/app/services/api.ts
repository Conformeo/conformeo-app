import { Filesystem, Directory } from '@capacitor/filesystem'; // <--- NOUVEAU
import { Platform } from '@ionic/angular/standalone'; // Pour savoir si on est sur mobile

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, Subject } from 'rxjs'; // <--- AJOUTE Subject
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
  cover_url?: string;
  date_creation?: string;
}

export interface Rapport {
  id?: number;
  titre: string;
  description: string;
  
  // 👇 C'EST ICI LA CORRECTION
  // Le backend envoie une liste d'objets { url: "..." }
  images?: { url: string }[]; 
  
  // On garde aussi celui-ci pour l'envoi lors de la création
  image_urls?: string[]; 
  
  photo_url?: string; // Compatibilité ancienne version
  chantier_id: number;
  date_creation?: string;
  niveau_urgence?: string;
  latitude?: number;
  longitude?: number;
}

export interface Materiel {
  id?: number;
  nom: string;
  reference: string;
  etat: string;
  chantier_id?: number | null;
}

export interface Inspection {
  id?: number;
  titre: string;
  type: string; // 'Securite', 'Qualite', 'Environnement'
  data: any[]; // [{ question: string, status: 'OK'|'NOK'|'NA', comment: string }]
  chantier_id: number;
  createur: string;
  date_creation?: string;
}

export interface PPSPS {
  id?: number;
  chantier_id: number;
  maitre_oeuvre: string;
  coordonnateur_sps: string;
  hopital_proche: string;
  responsable_securite: string;
  nb_compagnons: number;
  horaires: string;
  risques: any; 
  date_creation?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // ⚠️ Mets bien TON url Render ici
  private apiUrl = 'https://conformeo-api.onrender.com'; 

  // SIGNAL DE REFRESH GLOBAL
  public needsRefresh = false;
  

  constructor(
    private http: HttpClient,
    private offline: OfflineService
  ) { }

  // ==========================================
  // 🏗️ GESTION DES CHANTIERS (AVEC OFFLINE)
  // ==========================================

  // Convertir un Blob (Photo caméra) en Base64 (Texte stockable)
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
  }

  // Sauvegarder l'image physiquement dans le téléphone
  private async savePhotoLocally(blob: Blob): Promise<string> {
    const fileName = new Date().getTime() + '.jpeg';
    const base64Data = await this.blobToBase64(blob);
    
    // On écrit le fichier dans le dossier "Documents" de l'app
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data
    });

    // On retourne le chemin d'accès (uri)
    return savedFile.uri;
  }

  // Lire une image locale pour l'envoyer (quand le réseau revient)
  // Lire une image locale pour l'envoyer
  async readLocalPhoto(fileName: string): Promise<Blob> {
    // On force la lecture dans le dossier DATA (là où on a écrit)
    const readFile = await Filesystem.readFile({
      path: fileName,
      directory: Directory.Data 
    });

    // Conversion Base64 -> Blob
    // Le format retourné par Capacitor est parfois juste la string, parfois un objet.
    // On sécurise la récupération des données.
    const data = readFile.data instanceof Blob ? readFile.data : readFile.data;
    
    // Si c'est une string base64 pure (cas fréquent sur mobile)
    const response = await fetch(`data:image/jpeg;base64,${data}`);
    return await response.blob();
  }

  // --- LE TUNNEL PHOTO ---
  async addRapportWithPhoto(rapport: Rapport, photoBlob: Blob) {
    
    // CAS 1 : HORS LIGNE ✈️ -> On sauvegarde localement
    if (!this.offline.isOnline.value) {
      console.log('📡 Hors ligne : Sauvegarde photo locale...');
      
      // 1. Convertir Blob en Base64 pour le stockage
      const convertBlobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = reject;
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
      });

      const base64Data = await convertBlobToBase64(photoBlob);
      const fileName = new Date().getTime() + '.jpeg';

      // 2. Écrire sur le disque
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Data
        });
      } catch(e) {
        console.error("Erreur écriture fichier (normal sur Web, marche sur Mobile)", e);
        // Sur le web pour tester, on ne fait rien, mais sur mobile ça marchera
      }

      // 3. Mettre dans la file d'attente
      await this.offline.addToQueue('POST_RAPPORT_PHOTO', {
        rapport: rapport,
        localPhotoPath: fileName // On garde juste le nom du fichier
      });
      
      return true;
    }

    // CAS 2 : EN LIGNE 🌐 -> Upload direct
    else {
      this.uploadPhoto(photoBlob).subscribe({
        next: (res) => {
          this.createRapport(rapport, res.url).subscribe();
        },
        error: (err) => console.error(err)
      });
      return true;
    }
  }

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

  // Sauvegarder un rapport avec PLUSIEURS photos
// --- NOUVELLE METHODE MULTI-PHOTOS ---
  async addRapportWithMultiplePhotos(rapport: Rapport, photoBlobs: Blob[]) {
    
    // CAS 1 : HORS LIGNE ✈️
    if (!this.offline.isOnline.value) {
      console.log('📡 Hors ligne : Sauvegarde galerie locale...');
      const localPaths: string[] = [];

      // On sauvegarde chaque photo sur le disque
      for (const blob of photoBlobs) {
        try {
          const path = await this.savePhotoLocally(blob);
          localPaths.push(path);
        } catch (e) { console.error("Erreur sauvegarde locale", e); }
      }

      // On met en file d'attente (Action spéciale MULTI)
      await this.offline.addToQueue('POST_RAPPORT_MULTI', {
        rapport: rapport,
        localPaths: localPaths
      });
      return true;
    }

    // CAS 2 : EN LIGNE 🌐
    else {
      // On upload tout en parallèle (Promise.all) pour aller vite
      const uploadPromises = photoBlobs.map(blob => 
        new Promise<string>((resolve, reject) => {
          this.uploadPhoto(blob).subscribe({
            next: (res) => resolve(res.url),
            error: (err) => reject(err)
          });
        })
      );

      try {
        const urls = await Promise.all(uploadPromises);
        // On attache les URLs au rapport
        rapport.image_urls = urls;
        
        // On envoie le rapport final
        this.http.post(`${this.apiUrl}/rapports`, rapport).subscribe();
        return true;
      } catch (err) {
        console.error("Erreur upload multiple", err);
        return false;
      }
    }
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


  getInspections(chantierId: number): Observable<Inspection[]> {
    // Tu peux ajouter le cache offline ici si tu veux (comme pour les rapports)
    return this.http.get<Inspection[]>(`${this.apiUrl}/chantiers/${chantierId}/inspections`);
  }

  createInspection(insp: Inspection): Observable<Inspection> {
    return this.http.post<Inspection>(`${this.apiUrl}/inspections`, insp);
  }

  createPPSPS(doc: PPSPS): Observable<PPSPS> {
    return this.http.post<PPSPS>(`${this.apiUrl}/ppsps`, doc);
  }

  getPPSPSList(chantierId: number): Observable<PPSPS[]> {
    return this.http.get<PPSPS[]>(`${this.apiUrl}/chantiers/${chantierId}/ppsps`);
  }
}