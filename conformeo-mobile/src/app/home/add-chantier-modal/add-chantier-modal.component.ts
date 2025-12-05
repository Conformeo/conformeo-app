import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// 👇 TOUS LES IMPORTS IONIC INDISPENSABLES
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonList, IonItem, IonInput, ModalController,
  IonIcon, IonSpinner 
} from '@ionic/angular/standalone';

import { ApiService, Chantier } from '../../services/api';
import { addIcons } from 'ionicons';
import { camera, cloudUpload, save, close } from 'ionicons/icons';

@Component({
  selector: 'app-add-chantier-modal',
  templateUrl: './add-chantier-modal.component.html',
  styleUrls: ['./add-chantier-modal.component.scss'],
  standalone: true,
  // 👇 C'est ici que ça manquait !
  imports: [
    CommonModule, FormsModule, 
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
    IonContent, IonList, IonItem, IonInput, IonIcon, IonSpinner
  ]
})
export class AddChantierModalComponent {

  chantier: Chantier = {
    nom: '',
    client: '',
    adresse: '',
    est_actif: true
  };

  coverPhotoWebPath: string | undefined;
  coverPhotoBlob: Blob | undefined;
  isUploading = false;

  constructor(
    private modalCtrl: ModalController,
    private api: ApiService
  ) {
    addIcons({ camera, cloudUpload, save, close });
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async takeCoverPhoto() {
    const image = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera // Ou Prompt
    });
    
    if (image.webPath) {
      this.coverPhotoWebPath = image.webPath;
      const response = await fetch(image.webPath);
      this.coverPhotoBlob = await response.blob();
    }
  }

  save() {
    if (this.coverPhotoBlob) {
      this.isUploading = true;
      this.api.uploadPhoto(this.coverPhotoBlob).subscribe({
        next: (res) => {
           this.chantier.cover_url = res.url; // On récupère l'URL Cloudinary
           this.finalizeCreation();
        },
        error: () => {
           this.isUploading = false;
           alert("Erreur upload photo");
        }
      });
    } else {
      this.finalizeCreation();
    }
  }

  finalizeCreation() {
    this.api.createChantier(this.chantier).subscribe(newItem => {
      this.modalCtrl.dismiss(newItem, 'confirm');
    });
  }
}