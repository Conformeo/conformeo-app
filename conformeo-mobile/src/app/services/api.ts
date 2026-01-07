import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { NavController } from '@ionic/angular';
import { OfflineService } from './offline'; 

// --- INTERFACES ---

export interface Company {
  id: number;
  name: string;
  address?: string;
  contact_email?: string;
  phone?: string;
  logo_url?: string;
  subscription_plan: string;
}

export interface CompanyDoc {
  id: number;
  titre: string;
  type_doc: string; 
  url: string;
  date_expiration?: string;
  date_upload: string;
}

export interface DocExterne {
  id: number;
  titre: string;
  categorie: string;
  url: string;
  date_ajout: string;
}

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
  soumis_sps: boolean; // V11
  latitude?: number;   // V10 (GPS)
  longitude?: number;  // V10 (GPS)
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
}

export interface PIC {
  id?: number;
  chantier_id: number;
  background_url: string;
  final_url?: string;
  elements_data: any[]; 
  date_update?: string;
}

// Interface mise à jour avec les signatures
export interface PlanPrevention {
  id?: number;
  chantier_id: number;
  entreprise_utilisatrice: string;
  entreprise_exterieure: string;
  date_inspection_commune: string; // ISO Date
  signature_eu?: string; // Signature Client
  signature_ee?: string; // Signature Nous
  risques_interferents: { tache: string; risque: string; mesure: string }[];
  consignes_securite: {
    urgence?: string;
    rassemblement?: string;
    sanitaires?: string;
    fumeur?: string;
    permis_feu?: string;
  };
}

export interface User {
  id: number;
  email: string;
  role: string;
  company_id?: number;
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

  async isAuthenticated(): Promise<boolean> {
    if (this.token) return true;
    const { value } = await Preferences.get({ key: 'auth_token' });
    if (value) {
      this.token = value;
      return true;
    }
    return false;
  }

  // Ajoute le Header "Authorization: Bearer ..."
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
    const response = await fetch(`data:image/jpeg;base64,${data}`);
    return await response.blob();
  }

  // ==========================================
  // 🏢 GESTION ENTREPRISE (MON ENTREPRISE)
  // ==========================================

  getMyCompany(): Observable<Company> {
    return this.http.get<Company>(`${this.apiUrl}/companies/me`, this.getOptions());
  }

  updateCompany(data: any): Observable<Company> {
    return this.http.put<Company>(`${this.apiUrl}/companies/me`, data, this.getOptions());
  }

  getCompanyDocs(): Observable<CompanyDoc[]> {
    return this.http.get<CompanyDoc[]>(`${this.apiUrl}/companies/me/documents`, this.getOptions());
  }

  uploadCompanyDoc(file: File, titre: string, type_doc: string, date_expiration?: string): Observable<CompanyDoc> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('titre', titre);
    formData.append('type_doc', type_doc);
    if (date_expiration) formData.append('date_expiration', date_expiration);

    return this.http.post<CompanyDoc>(`${this.apiUrl}/companies/me/documents`, formData, this.getOptions());
  }

  deleteCompanyDoc(docId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/companies/me/documents/${docId}`, this.getOptions());
  }

  // ==========================================
  // 🏗️ CHANTIERS
  // ==========================================

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

  // --- GED CHANTIER (DOCS EXTERNES) ---
  
  getChantierDocs(chantierId: number): Observable<DocExterne[]> {
    return this.http.get<DocExterne[]>(`${this.apiUrl}/chantiers/${chantierId}/documents`, this.getOptions());
  }

  uploadChantierDoc(chantierId: number, file: File, titre: string, categorie: string): Observable<DocExterne> {
    const formData = new FormData();
    formData.append('file', file);
    const url = `${this.apiUrl}/chantiers/${chantierId}/documents?titre=${encodeURIComponent(titre)}&categorie=${encodeURIComponent(categorie)}`;
    return this.http.post<DocExterne>(url, formData, this.getOptions());
  }

  deleteChantierDoc(docId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/documents/${docId}`, this.getOptions());
  }

  // ==========================================
  // 📝 RAPPORTS
  // ==========================================

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
    // Ajout de getOptions() ici par sécurité
    return this.http.post<{url: string}>(`${this.apiUrl}/upload`, formData, this.getOptions());
  }

  createRapport(rapport: Rapport, photoUrl?: string): Observable<Rapport> {
    let url = `${this.apiUrl}/rapports`;
    if (photoUrl) url += `?photo_url=${encodeURIComponent(photoUrl)}`;
    if (!this.offline.isOnline.value) return of(rapport); 
    return this.http.post<Rapport>(url, rapport, this.getOptions());
  }

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

  // ==========================================
  // 🛠️ MATERIEL
  // ==========================================

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

  // ==========================================
  // 📑 DOCUMENTS (SPS, PIC, INSPECTIONS, PDP)
  // ==========================================

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

  downloadDOE(id: number) {
    const url = `${this.apiUrl}/chantiers/${id}/doe`;
    window.open(url, '_system');
  }

  // 👇 AJOUT DE GETOPTIONS() SUR CES MÉTHODES
  createPdp(data: any) {
    return this.http.post<PlanPrevention>(`${this.apiUrl}/plans-prevention`, data, this.getOptions());
  }

  getPdp(chantierId: number) {
    return this.http.get<PlanPrevention[]>(`${this.apiUrl}/chantiers/${chantierId}/plans-prevention`, this.getOptions());
  }

  getPdpPdfUrl(pdpId: number) {
    return `${this.apiUrl}/plans-prevention/${pdpId}/pdf`;
  }

  // ENVOI MAIL
  // Envoyer le PdP par email
  sendPdpEmail(pdpId: number, email: string) {
    // Note: l'API attend un paramètre de requête (query param) pour l'email
    return this.http.post(`${this.apiUrl}/plans-prevention/${pdpId}/send-email?email_dest=${email}`, {});
  }

  // ==========================================
  // 📊 DASHBOARD, TEAM & PROFIL
  // ==========================================
  
  getStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/dashboard/stats`, this.getOptions());
  }
  
  getTeam(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/team`, this.getOptions());
  }
  
  addTeamMember(user: any): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/team`, user, this.getOptions());
  }
  
  // 👇 AJOUT DE GETOPTIONS() ICI AUSSI
  getMe() {
    return this.http.get<any>(`${this.apiUrl}/users/me`, this.getOptions());
  }

  updateUser(data: any) {
    return this.http.put(`${this.apiUrl}/users/me`, data, this.getOptions());
  }
}