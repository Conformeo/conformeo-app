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
  soumis_sps: boolean;
  latitude?: number;
  longitude?: number;
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

export interface PlanPrevention {
  id?: number;
  chantier_id: number;
  entreprise_utilisatrice: string;
  entreprise_exterieure: string;
  date_inspection_commune: string;
  signature_eu?: string | null;
  signature_ee?: string | null;
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
  nom?: string;
  company_id?: number;
}

// J'ai assoupli l'interface pour accepter aussi {username, password} si besoin
export interface UserLogin { email?: string; username?: string; password: string; }
export interface Token { access_token: string; token_type: string; }

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  
  public apiUrl = 'https://conformeo-api.onrender.com'; 
  
  public needsRefresh = false;
  private token: string | null = null;

  constructor(
    public http: HttpClient,
    private offline: OfflineService,
    private navCtrl: NavController
  ) { 
    this.loadToken();
  }

  // --- AUTHENTIFICATION ---

  async loadToken() {
    // On charge depuis les préférences Capacitor
    const { value } = await Preferences.get({ key: 'auth_token' });
    this.token = value;
    
    // On synchronise aussi avec le localStorage pour getOptions()
    if (value) localStorage.setItem('token', value);
  }

  login(credentials: UserLogin): Observable<any> {
    const formData = new FormData();
    // Supporte 'email' ou 'username' pour la compatibilité
    formData.append('username', credentials.email || credentials.username || '');
    formData.append('password', credentials.password);

    return this.http.post<Token>(`${this.apiUrl}/token`, formData).pipe(
      tap(async (res) => {
        const t = res.access_token || (res as any).token;
        this.token = t;
        
        // 💾 SAUVEGARDE DOUBLE (Capacitor + LocalStorage)
        // C'est vital pour que getOptions() fonctionne immédiatement après
        await Preferences.set({ key: 'auth_token', value: t });
        localStorage.setItem('token', t);
        localStorage.setItem('access_token', t);
      })
    );
  }

  logout() {
    this.token = null;
    Preferences.remove({ key: 'auth_token' });
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
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

  // 👇 C'EST ICI QUE VOS ERREURS 401 SONT RÉSOLUES 👇
  public getOptions() {
    // 1. On essaie la variable mémoire
    let currentToken = this.token;

    // 2. Si vide, on force la lecture dans le localStorage
    if (!currentToken) {
      currentToken = localStorage.getItem('token') || localStorage.getItem('access_token');
    }

    // 3. Si on a trouvé un token, on l'injecte
    if (currentToken) {
      // On remet à jour la variable mémoire au passage
      this.token = currentToken;
      return {
        headers: new HttpHeaders({
          'Authorization': `Bearer ${currentToken}`
        })
      };
    }

    // 4. Sinon, headers minimums (provoquera une 401 légitime si route protégée)
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
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

    // On passe getOptions() pour l'auth, mais sans Content-Type JSON (car c'est du FormData)
    // Angular gère le boundary automatiquement
    const headers = this.getOptions().headers.delete('Content-Type'); 
    return this.http.post<CompanyDoc>(`${this.apiUrl}/companies/me/documents`, formData, { headers });
  }

  deleteCompanyDoc(docId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/companies/me/documents/${docId}`, this.getOptions());
  }

  // 👇 MÉTHODE POUR UPLOAD PHOTO GÉNÉRIQUE (Pour Logo Entreprise notamment)
  uploadPhoto(blob: Blob | File): Observable<{url: string}> {
    const formData = new FormData();
    formData.append('file', blob, 'photo.jpg');
    
    // Astuce pour FormData : ne pas forcer le Content-Type
    const headers = this.getOptions().headers.delete('Content-Type');
    return this.http.post<{url: string}>(`${this.apiUrl}/upload`, formData, { headers });
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
    const headers = this.getOptions().headers.delete('Content-Type');
    return this.http.post(`${this.apiUrl}/chantiers/import`, formData, { headers });
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
    const headers = this.getOptions().headers.delete('Content-Type');
    return this.http.post<DocExterne>(url, formData, { headers });
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
    const headers = this.getOptions().headers.delete('Content-Type');
    return this.http.post(`${this.apiUrl}/materiels/import`, formData, { headers });
  }

  // ==========================================
  // 📑 DOCUMENTS (SPS, PIC, INSPECTIONS, PDP, DUERP)
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
  
  // PIC
  savePIC(doc: any): Observable<any> {
    if (!doc.chantier_id) throw new Error("Chantier ID manquant pour le PIC");
    return this.http.post<any>(`${this.apiUrl}/chantiers/${doc.chantier_id}/pic`, doc, this.getOptions());
  }
  
  getPIC(chantierId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/chantiers/${chantierId}/pic`, this.getOptions());
  }
  
  signChantier(chantierId: number, signatureUrl: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/chantiers/${chantierId}/signature?signature_url=${encodeURIComponent(signatureUrl)}`, {}, this.getOptions());
  }

  signCompanyDoc(docId: number, nomSignataire: string, signatureUrl: string): Observable<any> {
    const payload = {
      nom_signataire: nomSignataire,
      signature_url: signatureUrl
    };
    return this.http.post(`${this.apiUrl}/companies/documents/${docId}/sign`, payload, this.getOptions());
  }

  downloadDOE(id: number) {
    const url = `${this.apiUrl}/chantiers/${id}/doe`;
    window.open(url, '_system');
  }

  // DUERP PDF Download
  downloadDuerpPdf(annee: string) {
    const url = `${this.apiUrl}/companies/me/duerp/${annee}/pdf`;
    
    // On force le type blob pour le téléchargement binaire
    // On utilise any pour contourner le typage strict d'Angular sur 'json'
    const headers = this.getOptions().headers;
    return this.http.get(url, { headers, responseType: 'blob' as 'json' });
  }

  // PLAN PREVENTION
  createPdp(data: any) {
    return this.http.post<PlanPrevention>(`${this.apiUrl}/plans-prevention`, data, this.getOptions());
  }

  getPdp(chantierId: number) {
    return this.http.get<PlanPrevention[]>(`${this.apiUrl}/chantiers/${chantierId}/plans-prevention`, this.getOptions());
  }

  getPdpPdfUrl(pdpId: number) {
    return `${this.apiUrl}/plans-prevention/${pdpId}/pdf`;
  }

  // ==========================================
  // 📧 ENVOI EMAILS
  // ==========================================

  sendPdpEmail(pdpId: number, email: string) {
    return this.http.post(`${this.apiUrl}/plans-prevention/${pdpId}/send-email?email_dest=${email}`, {}, this.getOptions());
  }

  sendJournalEmail(chantierId: number, email: string) {
    return this.http.post(`${this.apiUrl}/chantiers/${chantierId}/send-email?email_dest=${email}`, {}, this.getOptions());
  }

  // ==========================================
  // 📊 DASHBOARD, TEAM & PROFIL
  // ==========================================
  
  getStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/dashboard/stats`, this.getOptions());
  }
  
  getMe(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/me`, this.getOptions());
  }

  updateUser(data: any): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/me`, data, this.getOptions());
  }

  // --- GESTION ÉQUIPE (Team) ---

  getTeam(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/team`, this.getOptions());
  }

  inviteMember(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/team/invite`, data, this.getOptions());
  }

  updateTeamMember(userId: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/team/${userId}`, data, this.getOptions());
  }

  addTeamMember(user: any): Observable<User> {
    return this.inviteMember(user);
  }

  deleteMember(userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/team/${userId}`, this.getOptions());
  }
}