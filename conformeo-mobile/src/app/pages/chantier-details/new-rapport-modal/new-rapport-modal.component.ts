import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'; // <--- AJOUT CAMERA

// Imports des composants Ionic
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonList, IonItem, IonInput, IonLabel, 
  IonIcon, IonTextarea, IonSelect, IonSelectOption,
  ModalController, IonGrid, IonRow, IonCol, IonThumbnail
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { locationOutline, camera } from 'ionicons/icons'; // <--- AJOUT ICONE CAMERA

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
      
      <ion-grid class="ion-no-padding">
        <ion-row>
          
          <ion-col size="4" *ngFor="let photo of photosWebPath">
            <div class="photo-item" [style.background-image]="'url(' + photo + ')'"></div>
          </ion-col>

          <ion-col size="4">
            <div class="add-photo-btn" (click)="takePhoto()">
              <ion-icon name="camera" size="large"></ion-icon>
              <span>+ Photo</span>
            </div>
          </ion-col>

        </ion-row>
      </ion-grid>
      
      <ion-list lines="full" class="ion-margin-top">
        
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
  styles: [`
    .photo-item {
      width: 100%;
      padding-top: 100%; /* Ratio Carré 1:1 */
      background-size: cover;
      background-position: center;
      border-radius: 8px;
      border: 1px solid #ddd;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .add-photo-btn {
      width: 100%;
      padding-top: 100%; /* Ratio Carré 1:1 */
      background: #f4f5f8;
      border-radius: 8px;
      border: 2px dashed #ccc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #666;
      position: relative; /* Pour centrer le contenu absolu si besoin */
    }
    /* Astuce pour centrer le contenu dans le carré padding-top */
    .add-photo-btn ion-icon, .add-photo-btn span {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
    }
    .add-photo-btn ion-icon { top: 25%; }
    .add-photo-btn span { bottom: 25%; font-weight: bold; font-size: 0.9em; }
  `],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
    IonContent, IonList, IonItem, IonInput, IonLabel, 
    IonIcon, IonTextarea, IonSelect, IonSelectOption,
    IonGrid, IonRow, IonCol, IonThumbnail
  ]
})
export class NewRapportModalComponent implements OnInit {
  
  // On reçoit la toute première photo prise avant d'ouvrir la modale
  @Input() initialPhotoWebPath!: string;
  @Input() initialPhotoBlob!: Blob;
  
  // Listes pour gérer le multi-upload
  photosWebPath: string[] = [];
  photosBlobs: Blob[] = [];

  data = {
    titre: '',
    description: '',
    niveau_urgence: 'Faible'
  };
  
  gpsCoords: any = null;

  constructor(private modalCtrl: ModalController) {
    addIcons({ locationOutline, camera });
  }

  async ngOnInit() {
    // 1. On initialise la liste avec la première photo reçue
    if (this.initialPhotoWebPath && this.initialPhotoBlob) {
      this.photosWebPath.push(this.initialPhotoWebPath);
      this.photosBlobs.push(this.initialPhotoBlob);
    }

    // 2. GPS
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

  // Fonction pour ajouter une photo supplémentaire
  async takePhoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        correctOrientation: true
      });

      if (image.webPath) {
        // Ajout visuel
        this.photosWebPath.push(image.webPath);
        
        // Ajout données (Blob)
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        this.photosBlobs.push(blob);
      }
    } catch (e) {
      console.log('Ajout photo annulé');
    }
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    this.modalCtrl.dismiss({
      data: this.data,
      gps: this.gpsCoords,
      blobs: this.photosBlobs // On renvoie TOUTES les photos
    }, 'confirm');
  }
}