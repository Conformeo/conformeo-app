import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// 👇 IMPORT DES COMPOSANTS IONIC (Ajout de IonToggle et IonNote)
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonList, IonItem, IonInput, ModalController,
  IonIcon, IonSpinner, IonListHeader, IonLabel,
  IonToggle 
} from '@ionic/angular/standalone';

import { ApiService, Chantier } from '../../services/api' // Chemin standardisé
import { addIcons } from 'ionicons';

// 👇 AJOUT DE L'ICONE BOUCLIER (shield-checkmark-outline)
import { camera, cloudUpload, save, close, shieldCheckmarkOutline } from 'ionicons/icons';

@Component({
  selector: 'app-add-chantier-modal',
  templateUrl: './add-chantier-modal.component.html',
  styleUrls: ['./add-chantier-modal.component.scss'],
  standalone: true,
  // 👇 AJOUT DE IonToggle et IonNote DANS LES IMPORTS DU COMPOSANT
  imports: [
    CommonModule, FormsModule, 
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
    IonContent, IonList, IonItem, IonInput, IonIcon, IonSpinner, IonLabel,
    IonListHeader, IonToggle
  ]
})
export class AddChantierModalComponent implements OnInit {

  @Input() existingChantier: any = null;

  chantier: Chantier = {
    nom: '',
    client: '',
    adresse: '',
    est_actif: true,
    date_debut: new Date().toISOString(),
    date_fin: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(),
    soumis_sps: false // Par défaut NON
  };

  coverPhotoWebPath: string | undefined;
  coverPhotoBlob: Blob | undefined;
  isSaving = false;

  constructor(
    private modalCtrl: ModalController,
    private api: ApiService
  ) {
    // 👇 ENREGISTREMENT DE L'ICONE SPS
    addIcons({ camera, cloudUpload, save, close, shieldCheckmarkOutline });
  }

  ngOnInit() {
    if (this.existingChantier) {
      // On copie l'objet pour ne pas modifier l'original tant qu'on n'a pas sauvegardé
      this.chantier = { ...this.existingChantier };
      this.coverPhotoWebPath = this.chantier.cover_url;
      
      // Formatage des dates pour les inputs HTML (YYYY-MM-DD)
      if (this.chantier.date_debut) {
        // Gère le cas où c'est une string ou un objet Date
        const d = new Date(this.chantier.date_debut);
        this.chantier.date_debut = d.toISOString().split('T')[0];
      }
      if (this.chantier.date_fin) {
        const d = new Date(this.chantier.date_fin);
        this.chantier.date_fin = d.toISOString().split('T')[0];
      }
    } else {
      // Initialisation des dates par défaut (Aujourd'hui et +30 jours)
      const today = new Date();
      const nextMonth = new Date();
      nextMonth.setDate(today.getDate() + 30);
      
      this.chantier.date_debut = today.toISOString().split('T')[0];
      this.chantier.date_fin = nextMonth.toISOString().split('T')[0];
    }
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async takeCoverPhoto() {
    try {
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
    } catch (e) {
      console.log('Prise de photo annulée');
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
        error: () => { 
          this.isSaving = false; 
          alert("Erreur lors de l'envoi de la photo."); 
        }
      });
    } 
    // CAS 2 : Pas de nouvelle photo
    else {
      this.finalizeSave();
    }
  }

  finalizeSave() {
    // Petit nettoyage des dates si nécessaire (optionnel, l'API gère souvent)
    
    if (this.existingChantier) {
      // MODE UPDATE
      this.api.updateChantier(this.existingChantier.id, this.chantier).subscribe({
        next: (updated) => this.modalCtrl.dismiss(updated, 'confirm'),
        error: () => { 
          this.isSaving = false; 
          alert("Erreur lors de la modification."); 
        }
      });
    } else {
      // MODE CREATE
      this.api.createChantier(this.chantier).subscribe({
        next: (created) => this.modalCtrl.dismiss(created, 'confirm'),
        error: () => { 
          this.isSaving = false; 
          alert("Erreur lors de la création."); 
        }
      });
    }
  }
}