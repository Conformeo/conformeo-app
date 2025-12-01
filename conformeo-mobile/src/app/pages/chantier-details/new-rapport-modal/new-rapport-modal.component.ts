import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Geolocation } from '@capacitor/geolocation';

// Imports des composants Ionic
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonList, IonItem, IonInput, IonLabel, 
  IonIcon, IonTextarea, IonSelect, IonSelectOption,
  ModalController 
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { locationOutline } from 'ionicons/icons';

@Component({
  selector: 'app-new-rapport-modal',
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Nouveau Rapport</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="cancel()">Annuler</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      
      <img [src]="photoWebPath" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />
      
      <ion-list lines="full">
        
        <ion-item>
          <ion-input 
            label="Titre" 
            label-placement="stacked" 
            [(ngModel)]="data.titre" 
            placeholder="Ex: Fissure mur Est">
          </ion-input>
        </ion-item>

        <ion-item>
          <ion-textarea 
            label="Commentaire" 
            label-placement="stacked" 
            [(ngModel)]="data.description" 
            rows="4"
            auto-grow="true"
            placeholder="Décrivez l'anomalie en détail...">
          </ion-textarea>
        </ion-item>

        <ion-item>
          <ion-select 
            label="Gravité / Urgence" 
            label-placement="stacked" 
            [(ngModel)]="data.niveau_urgence" 
            interface="popover" 
            placeholder="Choisir le niveau">
            <ion-select-option value="Faible">🟢 Faible</ion-select-option>
            <ion-select-option value="Moyen">🟠 Moyen</ion-select-option>
            <ion-select-option value="Critique">🔴 Critique</ion-select-option>
          </ion-select>
        </ion-item>

        <ion-item lines="none">
          <ion-icon name="location-outline" slot="start" [color]="gpsCoords ? 'primary' : 'medium'"></ion-icon>
          <ion-label>
            <h3 *ngIf="gpsCoords" style="color: var(--ion-color-primary); font-weight: bold;">
              Position acquise ✅
            </h3>
            <p *ngIf="gpsCoords" style="font-size: 0.8em; color: #666;">
              Lat: {{ gpsCoords.latitude | number:'1.4-4' }}, Lon: {{ gpsCoords.longitude | number:'1.4-4' }}
            </p>
            <h3 *ngIf="!gpsCoords">Recherche GPS en cours... ⏳</h3>
          </ion-label>
        </ion-item>

      </ion-list>

      <ion-button expand="block" (click)="confirm()" [disabled]="!data.titre" class="ion-margin-top" size="large">
        Valider et Sauvegarder
      </ion-button>

    </ion-content>
  `,
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
    IonContent, IonList, IonItem, IonInput, IonLabel, 
    IonIcon, IonTextarea, IonSelect, IonSelectOption
  ]
})
export class NewRapportModalComponent implements OnInit {
  @Input() photoWebPath!: string;
  
  data = {
    titre: '',
    description: '',
    niveau_urgence: 'Faible'
  };
  
  gpsCoords: any = null;

  constructor(private modalCtrl: ModalController) {
    addIcons({ locationOutline });
  }

  async ngOnInit() {
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

  // 👇 C'EST ICI QU'IL MANQUAIT LES FONCTIONS 👇
  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    this.modalCtrl.dismiss({
      ...this.data,
      ...this.gpsCoords
    }, 'confirm');
  }
}