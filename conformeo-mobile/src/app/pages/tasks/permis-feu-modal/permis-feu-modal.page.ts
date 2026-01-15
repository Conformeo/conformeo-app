import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';

@Component({
  selector: 'app-permis-feu-modal',
  templateUrl: './permis-feu-modal.page.html',
  styleUrls: ['./permis-feu-modal.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class PermisFeuModalPage implements OnInit {
  
  // Données du formulaire
  formData = {
    date: new Date().toISOString(),
    lieu: '',
    description: '',
    intervenant: '',
    mesures: {
      extincteur: false,
      nettoyage: false,
      surveillance: false,
      alarme: false
    },
    signature: false
  };

  constructor(private modalCtrl: ModalController) { }

  ngOnInit() {
  }

  close() {
    this.modalCtrl.dismiss();
  }

  savePermis() {
    if (!this.formData.lieu || !this.formData.intervenant) {
      alert("Veuillez remplir le lieu et l'intervenant.");
      return;
    }
    
    // Ici, on enverrait normalement à l'API
    console.log("Permis validé :", this.formData);
    
    // On ferme en renvoyant "success"
    this.modalCtrl.dismiss({ saved: true }, 'confirm');
  }
}