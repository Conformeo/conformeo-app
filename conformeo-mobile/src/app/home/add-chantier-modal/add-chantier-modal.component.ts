import { Component } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular'; // Import IonicModule pour les composants UI
import { FormsModule } from '@angular/forms'; // Pour [(ngModel)]
import { CommonModule } from '@angular/common';
import { ApiService, Chantier } from '../../services/api';

@Component({
  selector: 'app-add-chantier-modal',
  templateUrl: './add-chantier-modal.component.html',
  styleUrls: ['./add-chantier-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule] // <-- Important : IonicModule ici
})
export class AddChantierModalComponent {

  // Données vides au départ
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
    // 1. Appel à l'API Python
    this.api.createChantier(this.chantier).subscribe({
      next: (newItem) => {
        // 2. Si succès, on ferme la modale en renvoyant le nouveau chantier
        this.modalCtrl.dismiss(newItem, 'confirm');
      },
      error: (err) => {
        console.error('Erreur création', err);
        alert("Erreur lors de la création du chantier");
      }
    });
  }
}