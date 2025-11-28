import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// 👇 ON IMPORTE CHAQUE COMPOSANT ICI (C'est la méthode moderne Standalone)
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonButtons, 
  IonButton, 
  IonContent, 
  IonList, 
  IonItem, 
  IonInput,
  ModalController 
} from '@ionic/angular/standalone';

import { ApiService, Chantier } from '../../services/api';

@Component({
  selector: 'app-add-chantier-modal',
  templateUrl: './add-chantier-modal.component.html',
  styleUrls: ['./add-chantier-modal.component.scss'],
  standalone: true,
  // 👇 ON LES AJOUTE DANS L'ARRAY IMPORTS
  imports: [
    CommonModule, 
    FormsModule, 
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonButtons, 
    IonButton, 
    IonContent, 
    IonList, 
    IonItem, 
    IonInput
  ]
})
export class AddChantierModalComponent {

  chantier: Chantier = {
    nom: '',
    client: '',
    adresse: '',
    est_actif: true
  };

  constructor(
    private modalCtrl: ModalController,
    private api: ApiService
  ) {}

  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  save() {
    this.api.createChantier(this.chantier).subscribe({
      next: (newItem) => {
        this.modalCtrl.dismiss(newItem, 'confirm');
      },
      error: (err) => {
        console.error('Erreur création', err);
      }
    });
  }
}