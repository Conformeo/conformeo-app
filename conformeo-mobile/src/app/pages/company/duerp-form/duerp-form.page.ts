import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// 👇 AJOUTEZ HttpHeaders ICI
import { HttpHeaders } from '@angular/common/http'; 
import { IonicModule, ToastController, LoadingController, AlertController } from '@ionic/angular';
import { ApiService } from '../../../services/api';
import { addIcons } from 'ionicons';
import { add, trash, save, download, arrowBack } from 'ionicons/icons';

@Component({
  selector: 'app-duerp-form',
  templateUrl: './duerp-form.page.html',
  styleUrls: ['./duerp-form.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class DuerpFormPage implements OnInit {

  annee = new Date().getFullYear().toString();
  lignes: any[] = [];
  
  constructor(
    private api: ApiService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController
  ) {
    addIcons({ add, trash, save, download, arrowBack });
  }

  ngOnInit() {
    this.loadDuerp();
  }

  loadDuerp() {
    this.api.http.get<any>(`${this.api.apiUrl}/companies/me/duerp/${this.annee}`, this.api.getOptions()).subscribe({
      next: (data) => {
        if (data.lignes) this.lignes = data.lignes;
        else this.lignes = [];
        if (this.lignes.length === 0) this.addRow(); 
      },
      error: (err) => {
        // Si on a une erreur 401 ici aussi, c'est que l'utilisateur est vraiment déconnecté
        if(err.status === 401) this.presentToast('Session expirée, reconnectez-vous.', 'warning');
        this.addRow();
      }
    });
  }

  addRow() {
    this.lignes.push({ tache: '', risque: '', gravite: 1, mesures_realisees: '', mesures_a_realiser: '' });
  }

  removeRow(index: number) {
    this.lignes.splice(index, 1);
  }

  async save() {
    const load = await this.loadingCtrl.create({ message: 'Sauvegarde...' });
    await load.present();
    const payload = { annee: this.annee, lignes: this.lignes };
    this.api.http.post(`${this.api.apiUrl}/companies/me/duerp`, payload, this.api.getOptions()).subscribe({
      next: () => { load.dismiss(); this.presentToast('DUERP enregistré ! ✅', 'success'); },
      error: () => { load.dismiss(); this.presentToast('Erreur sauvegarde', 'danger'); }
    });
  }

  // 👇 VERSION BLINDÉE DE LA FONCTION DE TÉLÉCHARGEMENT
  async downloadPdf() {
    console.log("1. Début demande téléchargement...");
    
    // 🔍 DIAGNOSTIC : On cherche le token sous plusieurs noms possibles
    let token = localStorage.getItem('token');
    
    // Si 'token' est vide, on essaie 'access_token' (nom fréquent)
    if (!token) {
        console.log("⚠️ Pas de 'token', essai avec 'access_token'...");
        token = localStorage.getItem('access_token');
    }

    // 🛑 STOP si toujours rien
    if (!token) {
        console.error("❌ ERREUR FATALE : Aucun token trouvé dans le stockage !");
        this.presentToast('Erreur : Vous semblez déconnecté (Token vide).', 'danger');
        // Force la déconnexion si vous avez une méthode pour ça, sinon :
        // this.router.navigate(['/login']);
        return;
    }

    console.log("✅ Token trouvé (début) :", token.substring(0, 10) + "...");

    const load = await this.loadingCtrl.create({ message: 'Génération du PDF...' });
    await load.present();

    const url = `${this.api.apiUrl}/companies/me/duerp/${this.annee}/pdf`;
    
    const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`
    });

    this.api.http.get(url, { headers, responseType: 'blob' }).subscribe({
      next: (blob: any) => {
        console.log("2. Fichier reçu (Taille):", blob.size);
        load.dismiss();
        
        const fileUrl = window.URL.createObjectURL(blob);
        
        // Méthode hybride (Fenêtre + Lien caché) pour max compatibilité
        const win = window.open(fileUrl, '_blank');
        
        if (!win) {
            console.log("⚠️ Popup bloquée, tentative lien direct...");
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = `DUERP_${this.annee}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        // Nettoyage plus rapide (10s)
        setTimeout(() => window.URL.revokeObjectURL(fileUrl), 10000);
        this.presentToast('PDF ouvert/téléchargé 📄', 'success');
      },
      error: (err) => {
        load.dismiss();
        console.error("3. ERREUR API :", err);
        
        if (err.status === 401) {
            this.presentToast('Session expirée : Veuillez vous reconnecter.', 'warning');
        } else if (err.status === 500) {
            this.presentToast('Erreur interne serveur (Python)', 'danger');
        } else {
            this.presentToast(`Erreur ${err.status}`, 'danger');
        }
      }
    });
  }

  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 3000, color });
    t.present();
  }
}