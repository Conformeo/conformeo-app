import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController, NavParams } from '@ionic/angular'; // 👈 AJOUT NavParams
import { ApiService } from '../../../services/api';

@Component({
  selector: 'app-permis-feu-modal',
  templateUrl: './permis-feu-modal.page.html',
  styleUrls: ['./permis-feu-modal.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class PermisFeuModalPage implements OnInit {
  
  @Input() chantierId!: number;

  formData = {
    lieu: '',
    intervenant: '',
    description: '',
    mesures: {
      extincteur: false,
      nettoyage: false,
      surveillance: false
    },
    signature: true
  };

  constructor(
    private modalCtrl: ModalController,
    private api: ApiService,
    private toastCtrl: ToastController,
    private navParams: NavParams // 👈 INJECTION
  ) { }

  ngOnInit() {
    // 🛡️ SÉCURITÉ : Si @Input est vide, on force la récupération via NavParams
    if (!this.chantierId) {
      this.chantierId = this.navParams.get('chantierId');
    }

    console.log("🛠️ MODALE OUVERTE - Chantier ID reçu :", this.chantierId);
    
    if (!this.chantierId) {
      // On utilise un Toast plutôt qu'une alerte bloquante
      this.presentToast("Erreur critique : Aucun ID de chantier reçu.", "danger");
    }
  }

  close() {
    this.modalCtrl.dismiss();
  }

  savePermis() {
    if (!this.chantierId) {
        this.presentToast("Impossible d'enregistrer : ID Chantier manquant", "danger");
        return;
    }

    if (!this.formData.lieu || !this.formData.intervenant) {
      this.presentToast("Veuillez remplir le lieu et l'intervenant.", "warning");
      return;
    }

    const payload = {
      chantier_id: this.chantierId,
      lieu: this.formData.lieu,
      intervenant: this.formData.intervenant,
      description: this.formData.description,
      extincteur: this.formData.mesures.extincteur,
      nettoyage: this.formData.mesures.nettoyage,
      surveillance: this.formData.mesures.surveillance,
      signature: true
    };

    this.api.savePermisFeu(payload).subscribe({
      next: async (res) => {
        this.presentToast('✅ Permis de Feu validé !', 'success');
        this.modalCtrl.dismiss({ saved: true }, 'confirm');
      },
      error: (err) => {
        console.error(err);
        this.presentToast("Erreur API lors de l'enregistrement.", "danger");
      }
    });
  }

  async presentToast(msg: string, color: string) {
    const toast = await this.toastCtrl.create({
      message: msg, duration: 3000, color: color, position: 'bottom'
    });
    toast.present();
  }
}