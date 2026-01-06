import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// 👇 TOUS LES IMPORTS IONIC INDISPENSABLES
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonList, IonItem, IonInput, ModalController,
  IonIcon, IonSpinner, IonLabel, IonListHeader
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
    IonContent, IonList, IonItem, IonInput, IonIcon, IonSpinner,
    IonLabel, IonListHeader
  ]
})
export class AddChantierModalComponent implements OnInit{

  @Input() existingChantier: any = null;

  chantier: Chantier = {
    nom: '',
    client: '',
    adresse: '',
    est_actif: true,
    // On initialise vide, le backend mettra les défauts si besoin
    date_debut: undefined,
    date_fin: undefined,
    soumis_sps: false
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
    if (this.existingChantier) {
      this.chantier = { ...this.existingChantier };
      this.coverPhotoWebPath = this.chantier.cover_url;
      
      // 👇 ASTUCE : On formatte la date pour l'input HTML (YYYY-MM-DD)
      if (this.chantier.date_debut) {
        this.chantier.date_debut = this.chantier.date_debut.split('T')[0];
      }
      if (this.chantier.date_fin) {
        this.chantier.date_fin = this.chantier.date_fin.split('T')[0];
      }
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