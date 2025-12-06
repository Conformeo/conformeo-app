import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { ApiService } from 'src/app/services/api';
import { addIcons } from 'ionicons';
import { close, save, personAdd } from 'ionicons/icons';

@Component({
  selector: 'app-add-member-modal',
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Nouveau Membre</ion-title>
        <ion-buttons slot="end"><ion-button (click)="closeModal()">Fermer</ion-button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-item>
        <ion-label position="stacked">Email</ion-label>
        <ion-input [(ngModel)]="data.email" placeholder="collegue@entreprise.com"></ion-input>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Mot de passe provisoire</ion-label>
        <ion-input [(ngModel)]="data.password" placeholder="******"></ion-input>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Rôle</ion-label>
        <ion-select [(ngModel)]="data.role">
          <ion-select-option value="conducteur">Conducteur de Travaux</ion-select-option>
          <ion-select-option value="chef">Chef de Chantier</ion-select-option>
          <ion-select-option value="admin">Administrateur</ion-select-option>
        </ion-select>
      </ion-item>
      <div class="ion-padding">
        <ion-button expand="block" (click)="save()">Ajouter à l'équipe</ion-button>
      </div>
    </ion-content>
  `,
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class AddMemberModalComponent {
  data = { email: '', password: '', role: 'conducteur' };

  constructor(private modalCtrl: ModalController, private api: ApiService) {
    addIcons({ close, save, personAdd });
  }

  closeModal() { this.modalCtrl.dismiss(); }

  save() {
    if (!this.data.email || !this.data.password) return;
    this.api.addTeamMember(this.data).subscribe({
      next: () => this.modalCtrl.dismiss(true, 'confirm'),
      error: (err) => alert("Erreur : " + err.error.detail)
    });
  }
}