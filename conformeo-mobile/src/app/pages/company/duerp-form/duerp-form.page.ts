import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, LoadingController, AlertController } from '@ionic/angular';
import { ApiService } from '../../../services/api'; // Votre service API
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
    // Appel API GET DUERP (à ajouter dans api.service.ts)
    this.api.http.get<any>(`${this.api.apiUrl}/companies/me/duerp/${this.annee}`, this.api.getOptions()).subscribe({
      next: (data) => {
        if (data.lignes) this.lignes = data.lignes;
        else this.lignes = [];
        
        if (this.lignes.length === 0) this.addRow(); // Une ligne vide par défaut
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

    // Appel API POST DUERP (à ajouter dans api.service.ts)
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

  downloadPdf() {
    const url = `${this.api.apiUrl}/companies/me/duerp/${this.annee}/pdf`;
    // Il faut ajouter le token dans l'URL ou utiliser le navigateur système qui gère les cookies/session si possible
    // Pour simplifier ici avec votre méthode :
    window.open(url, '_system');
  }

  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 2000, color });
    t.present();
  }
}