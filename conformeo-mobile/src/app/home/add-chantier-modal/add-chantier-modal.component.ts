import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular'; // <--- IMPORTANT : IonicModule
import { ApiService, Chantier } from '../../services/api';

@Component({
  selector: 'app-add-chantier-modal',
  templateUrl: './add-chantier-modal.component.html',
  styleUrls: ['./add-chantier-modal.component.scss'],
  standalone: true,
  // 👇 C'EST CETTE LIGNE QUI FAIT FONCTIONNER LES INPUTS 👇
  imports: [CommonModule, FormsModule, IonicModule] 
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
        alert("Erreur lors de la création");
      }
    });
  }
}