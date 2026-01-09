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
    
    // 1. On récupère le token BRUT (pour être sûr à 100%)
    const token = localStorage.getItem('token'); // Ou la clé que vous utilisez (ex: 'access_token')
    
    if (!token) {
        this.presentToast('Erreur : Vous êtes déconnecté.', 'danger');
        return;
    }

    const load = await this.loadingCtrl.create({ message: 'Génération du PDF...' });
    await load.present();

    const url = `${this.api.apiUrl}/companies/me/duerp/${this.annee}/pdf`;
    
    // 2. On construit les headers MANUELLEMENT
    const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`
    });

    // 3. On prépare la requête pour recevoir un BLOB (Fichier)
    this.api.http.get(url, { headers: headers, responseType: 'blob' }).subscribe({
      next: (blob: any) => {
        console.log("2. Fichier reçu !", blob);
        load.dismiss();
        
        const fileUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = `DUERP_${this.annee}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(fileUrl);
        
        this.presentToast('Téléchargement lancé 🚀', 'success');
      },
      error: (err) => {
        console.error("3. ERREUR :", err);
        load.dismiss();
        
        if (err.status === 401) {
            this.presentToast('Session expirée. Déconnectez-vous et réessayez.', 'warning');
        } else if (err.status === 500) {
            this.presentToast('Erreur Serveur (Le PDF plante côté Python)', 'danger');
        } else {
            this.presentToast(`Erreur ${err.status} lors du téléchargement`, 'danger');
        }
      }
    });
  }

  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 3000, color });
    t.present();
  }
}