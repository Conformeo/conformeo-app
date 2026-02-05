import { Component, Input, OnInit } from '@angular/core'; // Ajoutez Input
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { ApiService } from '../../../services/api'; // Importez l'API

@Component({
  selector: 'app-permis-feu-modal',
  templateUrl: './permis-feu-modal.page.html',
  styleUrls: ['./permis-feu-modal.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class PermisFeuModalPage implements OnInit {
  
  @Input() chantierId!: number; // On a besoin de l'ID du chantier !

  formData = {
    lieu: '',
    intervenant: '',
    description: '',
    mesures: {
      extincteur: false,
      nettoyage: false,
      surveillance: false
    },
    signature: false
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
      alert("Veuillez remplir le lieu et l'intervenant.");
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
      signature: true // Force signature to true or bind to formData.signature
    };

    // Envoi API
    this.api.savePermisFeu(payload).subscribe({
      next: async (res) => {
        const toast = await this.toastCtrl.create({
          message: '✅ Permis de Feu validé et enregistré !',
          duration: 3000,
          color: 'success'
        });
        toast.present();
        this.modalCtrl.dismiss({ saved: true }, 'confirm');
      },
      error: (err) => {
        console.error(err);
        // Better error handling
        const msg = err.error?.detail || "Erreur lors de l'enregistrement.";
        alert(msg);
      }
    });
  }
}