import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Chantier {
  id?: number;
  nom: string;
  adresse: string;
  client: string;
  est_actif: boolean;
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
  chantier_id?: number | null; // null = Dépôt
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // ATTENTION : Pour Android (émulateur), localhost devient 10.0.2.2.
  // Pour le navigateur web, on reste sur 127.0.0.1 ou localhost.
  // EN LOCAL (Commente cette ligne)
  // private apiUrl = 'http://127.0.0.1:8000'; 

  // EN PROD (Décommente et mets TON url Render sans le slash à la fin)
  private apiUrl = 'https://conformeo-api.onrender.com';

  constructor(private http: HttpClient) { }

  // Chantiers
  getChantiers(): Observable<Chantier[]> {
    return this.http.get<Chantier[]>(`${this.apiUrl}/chantiers`);
  }

  // Créer un nouveau chantier
  createChantier(chantier: Chantier): Observable<Chantier> {
    return this.http.post<Chantier>(`${this.apiUrl}/chantiers`, chantier);
  }

  // Récupérer un seul chantier
  getChantierById(id: number): Observable<Chantier> {
    return this.http.get<Chantier>(`${this.apiUrl}/chantiers/${id}`); // Note: On n'a pas créé cette route API spécifique, on fera sans pour l'instant ou on filtre en local, mais pour le MVP on va supposer qu'on charge la liste.
    // Correction pour le MVP rapide : On va tricher un peu si la route backend n'existe pas, mais créons les méthodes pour les rapports d'abord.
  }

  // 1. Récupérer les rapports d'un chantier
  getRapports(chantierId: number): Observable<Rapport[]> {
    return this.http.get<Rapport[]>(`${this.apiUrl}/chantiers/${chantierId}/rapports`);
  }

  // 2. Envoyer une photo (Upload)
  uploadPhoto(blob: Blob): Observable<{url: string}> {
    const formData = new FormData();
    formData.append('file', blob, 'photo_chantier.jpg');
    return this.http.post<{url: string}>(`${this.apiUrl}/upload`, formData);
  }

  // 3. Créer le rapport (Lien texte + photo)
  createRapport(rapport: Rapport, photoUrl?: string): Observable<Rapport> {
    // L'API attend le paramètre photo_url dans l'URL (query param) ou le body.
    // Dans notre code Python précédent : create_rapport(..., photo_url: Optional[str] = None)
    // On va passer photo_url en query param pour faire simple
    let url = `${this.apiUrl}/rapports`;
    if (photoUrl) {
      url += `?photo_url=${encodeURIComponent(photoUrl)}`;
    }
    return this.http.post<Rapport>(url, rapport);
  }

  getDashboardStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/dashboard/stats`);
  }

  getMateriels(): Observable<Materiel[]> {
    return this.http.get<Materiel[]>(`${this.apiUrl}/materiels`);
  }

  createMateriel(mat: Materiel): Observable<Materiel> {
    return this.http.post<Materiel>(`${this.apiUrl}/materiels`, mat);
  }

  transferMateriel(materielId: number, chantierId: number | null): Observable<any> {
    // Si chantierId est null, l'API comprendra "Retour dépôt" si on gère bien, 
    // ou on envoie 0. Notre API Python attend un entier optionnel.
    // Astuce : on envoie le paramètre en query string pour faire simple avec FastAPI
    let url = `${this.apiUrl}/materiels/${materielId}/transfert`;
    if (chantierId) {
      url += `?chantier_id=${chantierId}`;
    }
    return this.http.put(url, {});
  }

  signChantier(chantierId: number, signatureUrl: string): Observable<any> {
    // On envoie l'URL en paramètre query pour faire simple
    return this.http.put(`${this.apiUrl}/chantiers/${chantierId}/signature?signature_url=${encodeURIComponent(signatureUrl)}`, {});
  }
}