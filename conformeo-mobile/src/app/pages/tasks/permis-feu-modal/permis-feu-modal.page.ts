import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
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
    signature: true // ✅ Initialisé à true
  };

  constructor(
    private modalCtrl: ModalController,
    private api: ApiService,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {
    console.log("Permis Feu pour Chantier ID:", this.chantierId);
  }

  close() {
    this.modalCtrl.dismiss();
  }

  savePermis() {
    if (!this.formData.lieu || !this.formData.intervenant) {
      this.presentToast("Veuillez remplir le lieu et l'intervenant.", "warning");
      return;
    }

    // Préparation des données pour le Backend
    const payload = {
      chantier_id: this.chantierId,
      lieu: this.formData.lieu,
      intervenant: this.formData.intervenant,
      description: this.formData.description,
      extincteur: this.formData.mesures.extincteur,
      nettoyage: this.formData.mesures.nettoyage,
      surveillance: this.formData.mesures.surveillance,
      signature: true // ✅ Envoi explicite
    };

    // Envoi API
    this.api.savePermisFeu(payload).subscribe({
      next: async (res) => {
        this.presentToast('✅ Permis de Feu validé et enregistré !', 'success');
        this.modalCtrl.dismiss({ saved: true }, 'confirm');
      },
      error: (err) => {
        console.error(err);
        this.presentToast("Erreur lors de l'enregistrement. Vérifiez votre connexion.", "danger");
      }
    });
  }

  async presentToast(msg: string, color: string) {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 3000,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }
}