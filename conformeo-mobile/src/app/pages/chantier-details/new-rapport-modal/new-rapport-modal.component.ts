import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'; // <--- Ajout Camera ici

import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonList, IonItem, IonInput, IonLabel, 
  IonIcon, IonTextarea, IonSelect, IonSelectOption,
  IonGrid, IonRow, IonCol, // <--- Ajout Grid
  ModalController 
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { locationOutline, cameraOutline, trashOutline } from 'ionicons/icons'; // + trash

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
      
      <p style="font-weight:bold; margin-bottom:10px;">Photos ({{ photosWebPath.length }})</p>
      
      <ion-grid style="padding:0; margin-bottom: 20px;">
        <ion-row>
          <ion-col size="4" *ngFor="let photo of photosWebPath; let i = index">
            <div class="photo-thumb" [style.background-image]="'url(' + photo + ')'">
              <div class="delete-btn" (click)="removePhoto(i)">
                <ion-icon name="trash-outline"></ion-icon>
              </div>
            </div>
          </ion-col>

          <ion-col size="4">
            <div class="add-photo-btn" (click)="addPhoto()">
              <ion-icon name="camera-outline" size="large"></ion-icon>
              <span>Ajouter</span>
            </div>
          </ion-col>
        </ion-row>
      </ion-grid>
      
      <ion-list lines="full">
        <ion-item>
          <ion-input label="Titre" label-placement="stacked" [(ngModel)]="data.titre" placeholder="Ex: Fissure mur Est"></ion-input>
        </ion-item>

        <ion-item>
          <ion-textarea label="Commentaire" label-placement="stacked" [(ngModel)]="data.description" rows="3" auto-grow="true"></ion-textarea>
        </ion-item>

        <ion-item>
          <ion-select label="Gravité" label-placement="stacked" [(ngModel)]="data.niveau_urgence" interface="popover">
            <ion-select-option value="Faible">🟢 Faible</ion-select-option>
            <ion-select-option value="Moyen">🟠 Moyen</ion-select-option>
            <ion-select-option value="Critique">🔴 Critique</ion-select-option>
          </ion-select>
        </ion-item>

        <ion-item lines="none">
          <ion-icon name="location-outline" slot="start" [color]="gpsCoords ? 'primary' : 'medium'"></ion-icon>
          <ion-label>
            <h3 *ngIf="gpsCoords">Position acquise ✅</h3>
            <h3 *ngIf="!gpsCoords">Recherche GPS... ⏳</h3>
          </ion-label>
        </ion-item>
      </ion-list>

      <ion-button expand="block" (click)="confirm()" [disabled]="!data.titre" class="ion-margin-top" size="large">
        Valider ({{ photosWebPath.length }} photos)
      </ion-button>

    </ion-content>
  `,
  styles: [`
    .photo-thumb {
      width: 100%; padding-top: 100%; /* Carré */
      background-size: cover; background-position: center;
      border-radius: 8px; border: 1px solid #ddd;
      position: relative;
    }
    .delete-btn {
      position: absolute; top: -5px; right: -5px;
      background: red; color: white; border-radius: 50%;
      width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
    }
    .add-photo-btn {
      width: 100%; padding-top: 100%;
      background: #f4f5f8; border-radius: 8px; border: 2px dashed #ccc;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: #666; position: relative;
    }
    .add-photo-btn ion-icon { position: absolute; top: 30%; }
    .add-photo-btn span { position: absolute; bottom: 20%; font-size: 12px; }
  `],
  standalone: true,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonInput, IonLabel, IonIcon, IonTextarea, IonSelect, IonSelectOption, IonGrid, IonRow, IonCol]
})
export class NewRapportModalComponent implements OnInit {
  @Input() initialPhotoWebPath!: string;
  @Input() initialPhotoBlob!: Blob;

  photosWebPath: string[] = [];
  photosBlobs: Blob[] = []; // Liste des fichiers à envoyer

  data = { titre: '', description: '', niveau_urgence: 'Faible' };
  gpsCoords: any = null;

  constructor(private modalCtrl: ModalController) {
    addIcons({ locationOutline, cameraOutline, trashOutline });
  }

  async ngOnInit() {
    // On ajoute la première photo prise avant d'ouvrir la modale
    if (this.initialPhotoWebPath) {
      this.photosWebPath.push(this.initialPhotoWebPath);
      this.photosBlobs.push(this.initialPhotoBlob);
    }
    // GPS
    try {
      const position = await Geolocation.getCurrentPosition();
      this.gpsCoords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    } catch (e) {}
  }

  // Ajouter une autre photo depuis la modale
  async addPhoto() {
    const image = await Camera.getPhoto({
      quality: 80, allowEditing: false, resultType: CameraResultType.Uri, source: CameraSource.Camera, correctOrientation: true
    });
    if (image.webPath) {
      this.photosWebPath.push(image.webPath);
      const response = await fetch(image.webPath);
      this.photosBlobs.push(await response.blob());
    }
  }

  removePhoto(index: number) {
    this.photosWebPath.splice(index, 1);
    this.photosBlobs.splice(index, 1);
  }

  cancel() { this.modalCtrl.dismiss(null, 'cancel'); }

  confirm() {
    this.modalCtrl.dismiss({
      data: this.data,
      gps: this.gpsCoords,
      blobs: this.photosBlobs // On renvoie toute la liste !
    }, 'confirm');
  }
}