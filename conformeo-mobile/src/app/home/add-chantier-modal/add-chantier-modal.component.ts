import { Component, Input, OnInit } from '@angular/core';
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
export class AddChantierModalComponent implements OnInit{

  @Input() existingChantier: any = null;

  chantier: Chantier = {
    nom: '',
    client: '',
    adresse: '',
    est_actif: true
  };

  coverPhotoWebPath: string | undefined;
  coverPhotoBlob: Blob | undefined;
  isSaving = false;

  constructor(
    private modalCtrl: ModalController,
    private api: ApiService
  ) {
    addIcons({ camera, cloudUpload, save, close });
  }

  ngOnInit() {
    // SI MODIFICATION : On remplit les champs
    if (this.existingChantier) {
      this.chantier = { ...this.existingChantier }; // Copie pour ne pas modifier l'original tout de suite
      this.coverPhotoWebPath = this.chantier.cover_url; // Pour afficher l'image existante
    }
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
    if (this.isSaving) return;
    this.isSaving = true;

    // CAS 1 : Nouvelle photo à uploader
    if (this.coverPhotoBlob) {
      this.api.uploadPhoto(this.coverPhotoBlob).subscribe({
        next: (res) => {
           this.chantier.cover_url = res.url;
           this.finalizeSave();
        },
        error: () => { this.isSaving = false; alert("Erreur upload photo"); }
      });
    } 
    // CAS 2 : Pas de nouvelle photo (ou on garde l'ancienne)
    else {
      this.finalizeSave();
    }
  }

  finalizeSave() {
    if (this.existingChantier) {
      // MODE UPDATE
      this.api.updateChantier(this.existingChantier.id, this.chantier).subscribe({
        next: (updated) => this.modalCtrl.dismiss(updated, 'confirm'),
        error: () => { this.isSaving = false; alert("Erreur modification"); }
      });
    } else {
      // MODE CREATE
      this.api.createChantier(this.chantier).subscribe({
        next: (created) => this.modalCtrl.dismiss(created, 'confirm'),
        error: () => { this.isSaving = false; alert("Erreur création"); }
      });
    }
  }
}