import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonList, IonItem, IonInput, IonLabel, 
  IonIcon, IonSpinner, ModalController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, save, camera, image } from 'ionicons/icons';
import { ApiService } from 'src/app/services/api';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { removeBackground } from '@imgly/background-removal';

@Component({
  selector: 'app-add-materiel-modal',
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Nouvel Équipement</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="cancel()">Fermer</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      
      <div class="photo-zone" (click)="takePicture()" [class.has-image]="processedImage">
        
        <div *ngIf="!processedImage && !isProcessing" class="placeholder">
          <div class="icon-circle">
            <ion-icon name="camera"></ion-icon>
          </div>
          <p>Prendre une photo</p>
          <small>Détourage automatique IA ✨</small>
        </div>

        <div *ngIf="isProcessing" class="processing">
          <ion-spinner name="crescent" color="primary"></ion-spinner>
          <p>L'IA détoure votre objet...</p>
        </div>

        <img *ngIf="processedImage" [src]="processedImage" class="preview-img" />
      </div>

      <ion-list lines="full">
        <ion-item>
          <ion-input label="Nom" labelPlacement="stacked" [(ngModel)]="data.nom" placeholder="Ex: Perfo Hilti"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Référence" labelPlacement="stacked" [(ngModel)]="data.reference" placeholder="Ex: TE-30"></ion-input>
        </ion-item>
      </ion-list>

      <div class="ion-padding">
        <ion-button expand="block" (click)="save()" [disabled]="!data.nom || isUploading" size="large">
          <span *ngIf="!isUploading">Enregistrer</span>
          <ion-spinner *ngIf="isUploading"></ion-spinner>
        </ion-button>
      </div>

    </ion-content>
  `,
  styles: [`
    .photo-zone {
      height: 220px;
      background: #f4f5f8;
      border-radius: 16px;
      margin-bottom: 20px;
      display: flex; align-items: center; justify-content: center;
      border: 2px dashed #ccc;
      position: relative; overflow: hidden;
    }
    .photo-zone.has-image { border: none; background: white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
    
    .icon-circle {
      width: 60px; height: 60px; background: #e0e0e0; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;
    }
    .placeholder ion-icon { font-size: 30px; color: #666; }
    .placeholder p { margin: 0; font-weight: 600; color: #444; }
    .placeholder small { color: #888; }
    
    .processing { text-align: center; color: var(--ion-color-primary); font-weight: bold; }
    
    /* Fond damier pour voir la transparence */
    .preview-img {
      height: 100%; width: auto; object-fit: contain;
      background-image: linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%);
      background-size: 20px 20px;
    }
  `],
  standalone: true,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonInput, IonLabel, IonIcon, IonSpinner]
})
export class AddMaterielModalComponent {
  
  data = { nom: '', reference: '' };
  processedImage: string | null = null;
  imageBlob: Blob | null = null;
  
  isProcessing = false;
  isUploading = false;

  constructor(private modalCtrl: ModalController, private api: ApiService) {
    addIcons({ close, save, camera, image });
  }

  // 👇 LA NOUVELLE FONCTION CAMERA (Comme Chantier)
  async takePicture() {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera, // Ou Prompt pour laisser le choix
        correctOrientation: true
      });

      if (image.webPath) {
        this.processImage(image.webPath);
      }
    } catch (e) {
      console.log("Annulé");
    }
  }

  async processImage(path: string) {
    this.isProcessing = true;
    try {
        // 1. Convertir le chemin en Blob
        const response = await fetch(path);
        const originalBlob = await response.blob();

        // 2. Détourage IA
        const blobSansFond = await removeBackground(originalBlob);
        
        this.imageBlob = blobSansFond;
        this.processedImage = URL.createObjectURL(blobSansFond);
        
    } catch (error) {
        console.error("Erreur IA", error);
        alert("Erreur lors du détourage. Réessayez avec un fond plus uni.");
    } finally {
        this.isProcessing = false;
    }
  }

  cancel() { this.modalCtrl.dismiss(null, 'cancel'); }

  save() {
    if (this.imageBlob) {
      this.isUploading = true;
      this.api.uploadPhoto(this.imageBlob).subscribe({
        next: (res) => {
           this.createItem(res.url);
        },
        error: () => {
          this.isUploading = false;
          alert("Erreur upload image");
        }
      });
    } else {
      this.createItem(null);
    }
  }

  createItem(imageUrl: string | null) {
    const mat: any = {
      nom: this.data.nom,
      reference: this.data.reference,
      etat: 'Bon',
      image_url: imageUrl // On envoie l'URL !
    };

    this.api.createMateriel(mat).subscribe(() => {
      this.modalCtrl.dismiss(true, 'confirm');
    });
  }
}