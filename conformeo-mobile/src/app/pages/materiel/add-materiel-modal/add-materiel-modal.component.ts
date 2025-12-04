import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonList, IonItem, IonInput, 
  IonIcon, IonSpinner, ModalController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, save, cloudUpload, image } from 'ionicons/icons';
import { ApiService, Materiel } from 'src/app/services/api';

// 👇 L'IMPORT MAGIQUE
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
      
      <div class="upload-zone" (click)="fileInput.click()" [class.has-image]="processedImage">
        <input #fileInput type="file" (change)="onFileSelected($event)" accept="image/*" hidden />
        
        <div *ngIf="!processedImage && !isProcessing" class="placeholder">
          <ion-icon name="cloud-upload" size="large"></ion-icon>
          <p>Cliquez pour ajouter une photo</p>
          <small>Le fond sera supprimé automatiquement ✨</small>
        </div>

        <div *ngIf="isProcessing" class="processing">
          <ion-spinner color="primary"></ion-spinner>
          <p>Détourage par IA en cours...</p>
        </div>

        <img *ngIf="processedImage" [src]="processedImage" class="preview-img" />
      </div>

      <ion-list lines="full">
        <ion-item>
          <ion-input label="Nom de l'équipement" labelPlacement="stacked" [(ngModel)]="data.nom" placeholder="Ex: Perceuse Makita"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Référence / Série" labelPlacement="stacked" [(ngModel)]="data.reference" placeholder="Ex: MAK-2024-01"></ion-input>
        </ion-item>
      </ion-list>

      <div class="ion-padding">
        <ion-button expand="block" (click)="save()" [disabled]="!data.nom || isUploading">
          <span *ngIf="!isUploading">Enregistrer</span>
          <ion-spinner *ngIf="isUploading"></ion-spinner>
        </ion-button>
      </div>

    </ion-content>
  `,
  styles: [`
    .upload-zone {
      height: 200px;
      border: 2px dashed #ccc;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      background: #f9f9f9;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }
    .upload-zone.has-image { border: 2px solid var(--ion-color-primary); background: white; }
    
    .placeholder { text-align: center; color: #888; }
    .placeholder ion-icon { font-size: 48px; color: var(--ion-color-primary); margin-bottom: 10px; }
    
    .processing { text-align: center; color: var(--ion-color-primary); font-weight: bold; }
    
    .preview-img { 
      height: 100%; 
      width: auto; 
      object-fit: contain; 
      /* Petit damier pour montrer la transparence */
      background-image: linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
    }
  `],
  standalone: true,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonInput, IonIcon, IonSpinner]
})
export class AddMaterielModalComponent {
  
  data = { nom: '', reference: '' };
  
  processedImage: string | null = null; // URL pour l'affichage (base64)
  imageBlob: Blob | null = null;        // Fichier pour l'upload
  
  isProcessing = false;
  isUploading = false;

  constructor(private modalCtrl: ModalController, private api: ApiService) {
    addIcons({ close, save, cloudUpload, image });
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.isProcessing = true;

    try {
      // 👇 LA MAGIE IMGLY
      // Config : On peut ajuster la qualité ou le modèle si besoin
      const blob = await removeBackground(file);
      
      this.imageBlob = blob;
      this.processedImage = URL.createObjectURL(blob);
      
    } catch (error) {
      console.error("Erreur détourage", error);
      alert("Impossible de détourer l'image. Essayez une autre photo.");
    } finally {
      this.isProcessing = false;
    }
  }

  cancel() { this.modalCtrl.dismiss(null, 'cancel'); }

  save() {
    if (this.imageBlob) {
      this.isUploading = true;
      // 1. Upload de l'image détourée vers Cloudinary
      this.api.uploadPhoto(this.imageBlob).subscribe({
        next: (res) => {
           // 2. Création du matériel avec l'image (On triche, on n'a pas encore de colonne 'image' dans Materiel, on va l'ajouter !)
           // Pour l'instant on sauvegarde, on ajoutera la colonne après.
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
    // Note : Il faudra ajouter 'image_url' au modèle Materiel Backend pour que ça soit stocké !
    // Pour l'instant on envoie juste les infos de base.
    const mat: any = {
      nom: this.data.nom,
      reference: this.data.reference,
      etat: 'Bon',
      // image_url: imageUrl  <-- A DECOMMENTER QUAND BACKEND PRET
    };

    this.api.createMateriel(mat).subscribe(() => {
      this.modalCtrl.dismiss(true, 'confirm');
    });
  }
}