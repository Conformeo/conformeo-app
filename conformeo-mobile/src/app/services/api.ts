import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { NavController } from '@ionic/angular';
import { OfflineService } from './offline'; // Vérifiez le chemin (.service)

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
  company_id?: number;
  date_debut?: string;
  date_fin?: string;
  statut_planning?: string;
  soumis_sps: boolean
}

export interface Rapport {
  id?: number;
  titre: string;
  description: string;
  images?: { url: string }[]; 
  image_urls?: string[]; 
  photo_url?: string;
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
  image_url?: string | null;
  chantier_id?: number | null;
}

export interface Inspection {
  id?: number;
  titre: string;
  type: string;
  data: any[]; 
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
  // Autres champs PPSPS...
}

export interface PIC {
  id?: number;
  chantier_id: number;
  background_url: string;
  final_url?: string;
  elements_data: any[]; 
  date_update?: string;
}

export interface UserLogin { email: string; password: string; }
export interface Token { access_token: string; token_type: string; }

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = 'https://conformeo-api.onrender.com'; 
  
  public needsRefresh = false;
  private token: string | null = null;

  constructor(
    private http: HttpClient,
    private offline: OfflineService,
    private navCtrl: NavController
  ) { 
    this.loadToken();
  }

  // --- AUTHENTIFICATION ---

  async loadToken() {
    const { value } = await Preferences.get({ key: 'auth_token' });
    this.token = value;
  }

  login(credentials: UserLogin): Observable<any> {
    const formData = new FormData();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);

    return this.http.post<Token>(`${this.apiUrl}/token`, formData).pipe(
      tap(async (res) => {
        this.token = res.access_token;
        await Preferences.set({ key: 'auth_token', value: res.access_token });
      })
    );
  }

  logout() {
    this.token = null;
    Preferences.remove({ key: 'auth_token' });
    this.navCtrl.navigateRoot('/login');
  }

  // 👇 CORRECTION MAJEURE : ASYNC pour éviter le bug F5
  async isAuthenticated(): Promise<boolean> {
    if (this.token) return true;
    const { value } = await Preferences.get({ key: 'auth_token' });
    if (value) {
      this.token = value;
      return true;
    }
    return false;
  }

  private getOptions() {
    if (this.token) {
      return {
        headers: new HttpHeaders({
          'Authorization': `Bearer ${this.token}`
        })
      };
    }
    return {};
  }

  // --- OFFLINE TOOLS ---

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }

  private async savePhotoLocally(blob: Blob): Promise<string> {
    const fileName = new Date().getTime() + '.jpeg';
    const base64Data = await this.blobToBase64(blob);
    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data
    });
    return fileName;
  }

  async readLocalPhoto(fileName: string): Promise<Blob> {
    const readFile = await Filesystem.readFile({
      path: fileName,
      directory: Directory.Data 
    });
    const data = readFile.data;
    // Conversion base64 -> blob
    const response = await fetch(`data:image/jpeg;base64,${data}`);
    return await response.blob();
  }

  // --- CHANTIERS ---

  getChantiers(): Observable<Chantier[]> {
    if (this.offline.isOnline.value) {
      return this.http.get<Chantier[]>(`${this.apiUrl}/chantiers`, this.getOptions()).pipe(
        tap(data => this.offline.set('chantiers_cache', data))
      );
    } else {
      return from(this.offline.get('chantiers_cache')).pipe(switchMap(d => of(d || [])));
    }
  }

  importChantiersCSV(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/chantiers/import`, formData, this.getOptions());
  }

  createChantier(chantier: Chantier): Observable<Chantier> {
    if (!this.offline.isOnline.value) {
      this.offline.addToQueue('POST_CHANTIER', chantier);
      return of({ ...chantier, id: 9999, est_actif: true });
    }
    return this.http.post<Chantier>(`${this.apiUrl}/chantiers`, chantier, this.getOptions());
  }

  updateChantier(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/chantiers/${id}`, data, this.getOptions());
  }

  deleteChantier(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/chantiers/${id}`, this.getOptions());
  }
  
  getChantierById(id: number): Observable<Chantier> {
    return this.http.get<Chantier>(`${this.apiUrl}/chantiers/${id}`, this.getOptions());
  }

  // --- RAPPORTS ---

  getRapports(chantierId: number): Observable<Rapport[]> {
    if (this.offline.isOnline.value) {
      return this.http.get<Rapport[]>(`${this.apiUrl}/chantiers/${chantierId}/rapports`, this.getOptions()).pipe(
        tap(data => this.offline.set(`rapports_${chantierId}`, data))
      );
    } else {
      return from(this.offline.get(`rapports_${chantierId}`)).pipe(switchMap(d => of(d || [])));
    }
  }

  uploadPhoto(blob: Blob): Observable<{url: string}> {
    if (!this.offline.isOnline.value) throw new Error("Offline");
    const formData = new FormData();
    formData.append('file', blob, 'photo.jpg');
    return this.http.post<{url: string}>(`${this.apiUrl}/upload`, formData);
  }

  createRapport(rapport: Rapport, photoUrl?: string): Observable<Rapport> {
    let url = `${this.apiUrl}/rapports`;
    if (photoUrl) url += `?photo_url=${encodeURIComponent(photoUrl)}`;
    if (!this.offline.isOnline.value) return of(rapport); 
    return this.http.post<Rapport>(url, rapport, this.getOptions());
  }

  // Fonction Tunnel (Multi Photos)
  async addRapportWithMultiplePhotos(rapport: Rapport, photoBlobs: Blob[]) {
    if (!this.offline.isOnline.value) {
      const localPaths: string[] = [];
      for (const blob of photoBlobs) {
        try {
          const path = await this.savePhotoLocally(blob);
          localPaths.push(path);
        } catch (e) {}
      }
      await this.offline.addToQueue('POST_RAPPORT_MULTI', {
        rapport: rapport,
        localPaths: localPaths
      });
      return true;
    } else {
      // Mode Online : On upload tout en //
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
        rapport.image_urls = urls;
        this.http.post(`${this.apiUrl}/rapports`, rapport, this.getOptions()).subscribe();
        return true;
      } catch (err) { return false; }
    }
  }

  // --- COMPANY ---
  getMyCompany(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/companies/me`, this.getOptions());
  }

  updateMyCompany(data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/companies/me`, data, this.getOptions());
  }

  // --- MATERIEL ---
  getMateriels(): Observable<Materiel[]> {
    if (this.offline.isOnline.value) {
      return this.http.get<Materiel[]>(`${this.apiUrl}/materiels`, this.getOptions()).pipe(
        tap(data => this.offline.set('materiels_cache', data))
      );
    } else {
      return from(this.offline.get('materiels_cache')).pipe(switchMap(d => of(d || [])));
    }
  }

  createMateriel(mat: Materiel): Observable<Materiel> {
    return this.http.post<Materiel>(`${this.apiUrl}/materiels`, mat, this.getOptions());
  }

  updateMateriel(id: number, mat: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/materiels/${id}`, mat, this.getOptions());
  }

  deleteMateriel(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/materiels/${id}`, this.getOptions());
  }
  
  transferMateriel(id: number, chantierId: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/materiels/${id}/transfert?chantier_id=${chantierId || ''}`, {}, this.getOptions());
  }

  importMaterielsCSV(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/materiels/import`, formData, this.getOptions());
  }

  // --- DOCUMENTS ---
  createPPSPS(doc: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/ppsps`, doc, this.getOptions());
  }
  getPPSPSList(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/chantiers/${id}/ppsps`, this.getOptions());
  }
  
  createInspection(doc: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/inspections`, doc, this.getOptions());
  }
  getInspections(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/chantiers/${id}/inspections`, this.getOptions());
  }
  
  savePIC(doc: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/pics`, doc, this.getOptions());
  }
  getPIC(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/chantiers/${id}/pic`, this.getOptions());
  }
  signChantier(chantierId: number, signatureUrl: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/chantiers/${chantierId}/signature?signature_url=${encodeURIComponent(signatureUrl)}`, {}, this.getOptions());
  }

  // --- DASHBOARD & TEAM ---
  getStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/dashboard/stats`, this.getOptions());
  }
  getTeam(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/team`, this.getOptions());
  }
  addTeamMember(user: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/team`, user, this.getOptions());
  }

  downloadDOE(id: number) {
    const url = `${this.apiUrl}/chantiers/${id}/doe`;
    window.open(url, '_system');
  }
}