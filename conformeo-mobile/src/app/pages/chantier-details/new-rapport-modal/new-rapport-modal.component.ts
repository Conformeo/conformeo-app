import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { Geolocation } from '@capacitor/geolocation';

@Component({
  selector: 'app-new-rapport-modal',
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Nouveau Rapport</ion-title>
        <ion-buttons slot="end"><ion-button (click)="cancel()">Annuler</ion-button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      
      <img [src]="photoWebPath" style="width:100%; height:200px; object-fit:cover; border-radius:8px; margin-bottom:10px;">
      
      <ion-list lines="full">
        <ion-item>
          <ion-label position="stacked">Titre de l'observation</ion-label>
          <ion-input [(ngModel)]="data.titre" placeholder="Ex: Fissure mur Est"></ion-input>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Commentaire</ion-label>
          <ion-textarea [(ngModel)]="data.description" rows="3" placeholder="Détails..."></ion-textarea>
        </ion-item>

        <ion-item>
          <ion-label>Gravité</ion-label>
          <ion-select [(ngModel)]="data.niveau_urgence">
            <ion-select-option value="Faible">🟢 Faible</ion-select-option>
            <ion-select-option value="Moyen">🟠 Moyen</ion-select-option>
            <ion-select-option value="Critique">🔴 Critique</ion-select-option>
          </ion-select>
        </ion-item>

        <ion-item>
          <ion-icon name="location-outline" slot="start"></ion-icon>
          <ion-label>
            <h3 *ngIf="gpsCoords">Position acquise ✅</h3>
            <h3 *ngIf="!gpsCoords">Recherche GPS... ⏳</h3>
          </ion-label>
        </ion-item>
      </ion-list>

      <ion-button expand="block" (click)="confirm()" [disabled]="!data.titre" class="ion-margin-top">
        Valider et Sauvegarder
      </ion-button>
    </ion-content>
  `,
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class NewRapportModalComponent implements OnInit {
  @Input() photoWebPath!: string;
  
  data = {
    titre: '',
    description: '',
    niveau_urgence: 'Faible'
  };
  
  gpsCoords: any = null;

  constructor(private modalCtrl: ModalController) {}

  async ngOnInit() {
    // On lance la géolocalisation dès l'ouverture
    try {
      const position = await Geolocation.getCurrentPosition();
      this.gpsCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
    } catch (e) {
      console.error("Erreur GPS", e);
    }
  }

  cancel() { this.modalCtrl.dismiss(null, 'cancel'); }

  confirm() {
    this.modalCtrl.dismiss({
      ...this.data,
      ...this.gpsCoords
    }, 'confirm');
  }
}