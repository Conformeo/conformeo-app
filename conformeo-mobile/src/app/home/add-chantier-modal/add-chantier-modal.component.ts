import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// 👇 TOUS LES IMPORTS IONIC NECESSAIRES
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonList, IonItem, IonInput, ModalController,
  IonIcon 
} from '@ionic/angular/standalone';

import { ApiService, Chantier } from '../../services/api';
import { addIcons } from 'ionicons';
import { camera } from 'ionicons/icons';

@Component({
  selector: 'app-add-chantier-modal',
  templateUrl: './add-chantier-modal.component.html',
  styleUrls: ['./add-chantier-modal.component.scss'],
  standalone: true,
  // 👇 ON LISTE BIEN TOUT ICI
  imports: [
    CommonModule, 
    FormsModule, 
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
    IonContent, IonList, IonItem, IonInput, IonIcon
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

  constructor(
    private modalCtrl: ModalController,
    private api: ApiService
  ) {
    addIcons({ camera });
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async takeCoverPhoto() {
    const image = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera
    });
    
    if (image.webPath) {
      this.coverPhotoWebPath = image.webPath;
      const response = await fetch(image.webPath);
      this.coverPhotoBlob = await response.blob();
    }
  }

  save() {
    if (this.coverPhotoBlob) {
      this.api.uploadPhoto(this.coverPhotoBlob).subscribe(res => {
        this.chantier.cover_url = res.url;
        this.finalizeCreation();
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