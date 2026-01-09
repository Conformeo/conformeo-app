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
    const load = await this.loadingCtrl.create({ message: 'Génération du PDF...' });
    await load.present();

    const url = `${this.api.apiUrl}/companies/me/duerp/${this.annee}/pdf`;
    
    // On récupère le token
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.api.http.get(url, { headers, responseType: 'blob' }).subscribe({
      next: (blob: any) => {
        console.log("2. Fichier reçu !", blob);
        load.dismiss();
        
        // 1. URL Blob
        const fileUrl = window.URL.createObjectURL(blob);
        
        // 2. Stratégie double : Ouvrir ET Télécharger
        
        // A. Essayer d'ouvrir dans une nouvelle fenêtre (Meilleur pour mobile)
        const win = window.open(fileUrl, '_blank');
        
        // B. Si le navigateur a bloqué la fenêtre (win est null), on tente le téléchargement forcé
        if (!win) {
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = `DUERP_${this.annee}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.presentToast('Si le fichier ne s\'ouvre pas, vérifiez vos pop-ups.', 'warning');
        } else {
            this.presentToast('PDF ouvert 📄', 'success');
        }

        // Nettoyage après 1 minute (pour laisser le temps au mobile d'ouvrir)
        setTimeout(() => window.URL.revokeObjectURL(fileUrl), 60000);
      },
      error: (err) => {
        console.error("Erreur", err);
        load.dismiss();
        this.presentToast('Erreur téléchargement', 'danger');
      }
    });
  }

  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 3000, color });
    t.present();
  }
}