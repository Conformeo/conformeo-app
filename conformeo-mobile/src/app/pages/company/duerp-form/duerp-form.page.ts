import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, LoadingController, AlertController } from '@ionic/angular';
import { ApiService } from '../../../services/api'; // Vérifiez que le chemin est bon
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
    // Récupération des données
    this.api.http.get<any>(`${this.api.apiUrl}/companies/me/duerp/${this.annee}`, this.api.getOptions()).subscribe({
      next: (data) => {
        if (data.lignes) this.lignes = data.lignes;
        else this.lignes = [];
        
        // Ajout d'une ligne vide par défaut si le tableau est vide
        if (this.lignes.length === 0) this.addRow(); 
      },
      error: () => this.addRow()
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
      next: () => {
        load.dismiss();
        this.presentToast('DUERP enregistré ! ✅', 'success');
      },
      error: () => {
        load.dismiss();
        this.presentToast('Erreur sauvegarde', 'danger');
      }
    });
  }

  // 👇 MISE À JOUR : TÉLÉCHARGEMENT SÉCURISÉ
  // ...

  async downloadPdf() {
    console.log("1. Début demande téléchargement...");
    
    const load = await this.loadingCtrl.create({ message: 'Génération du PDF...' });
    await load.present();

    const url = `${this.api.apiUrl}/companies/me/duerp/${this.annee}/pdf`;
    
    // Options pour récupérer le fichier binaire (Blob) avec le Token
    const options: any = {
      headers: this.api.getOptions().headers, 
      responseType: 'blob' 
    };

    this.api.http.get(url, options).subscribe({
      next: (blob: any) => {
        console.log("2. Fichier reçu du serveur !", blob);
        load.dismiss();
        
        // --- MÉTHODE ROBUSTE (Lien invisible) ---
        // 1. Créer une URL pour le blob
        const fileUrl = window.URL.createObjectURL(blob);
        
        // 2. Créer un lien <a> invisible
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = `DUERP_${this.annee}.pdf`; // Nom du fichier forcé
        
        // 3. L'ajouter au DOM, cliquer, et le retirer
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 4. Nettoyer
        window.URL.revokeObjectURL(fileUrl);
        
        this.presentToast('Téléchargement lancé 🚀', 'success');
      },
      error: (err) => {
        console.error("3. ERREUR TÉLÉCHARGEMENT :", err);
        load.dismiss();
        
        // Afficher l'erreur exacte à l'utilisateur pour comprendre
        let msg = 'Erreur technique';
        if (err.status === 500) msg = 'Erreur Serveur (Vérifiez le code Python)';
        if (err.status === 404) msg = 'Document introuvable';
        
        this.presentToast(`Échec : ${msg}`, 'danger');
      }
    });
  }

  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 2000, color });
    t.present();
  }
}