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
  async downloadPdf() {
    const load = await this.loadingCtrl.create({ message: 'Génération du PDF...' });
    await load.present();

    const url = `${this.api.apiUrl}/companies/me/duerp/${this.annee}/pdf`;
    
    // On construit les options manuellement pour inclure le Token ET le type Blob
    const options: any = {
      headers: this.api.getOptions().headers, // Récupère le token de votre service
      responseType: 'blob' // Indispensable pour les fichiers PDF/Images
    };

    this.api.http.get(url, options).subscribe({
      next: (blob: any) => {
        load.dismiss();
        
        // 1. Création d'une URL temporaire pour le fichier
        const fileUrl = window.URL.createObjectURL(blob);
        
        // 2. Ouverture dans le navigateur système (ou visualiseur PDF)
        window.open(fileUrl, '_system');
        
        this.presentToast('PDF téléchargé 📄', 'success');
      },
      error: (err) => {
        console.error(err);
        load.dismiss();
        this.presentToast('Erreur lors du téléchargement', 'danger');
      }
    });
  }

  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 2000, color });
    t.present();
  }
}