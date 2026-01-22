import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// 👇 IMPORT DES COMPOSANTS IONIC STANDALONE
// J'ai ajouté IonDatetime, IonDatetimeButton et IonModal pour éviter les erreurs de template
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonList, IonItem, IonInput, ModalController,
  IonIcon, IonSpinner, IonLabel, IonListHeader, 
  IonToggle, IonNote, ToastController,
  IonDatetime, IonDatetimeButton, IonModal
} from '@ionic/angular/standalone';

import { ApiService, Chantier } from '../../services/api';
import { addIcons } from 'ionicons';
import { camera, cloudUpload, save, close, shieldCheckmarkOutline, image } from 'ionicons/icons';

@Component({
  selector: 'app-add-chantier-modal',
  templateUrl: './add-chantier-modal.component.html',
  styleUrls: ['./add-chantier-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
    IonContent, IonList, IonItem, IonInput, IonIcon, IonSpinner,
    IonLabel, IonListHeader, IonToggle, IonNote,
    // 👇 Indispensables pour les dates
    IonDatetime, IonDatetimeButton, IonModal
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
    soumis_sps: false
  };

  coverPhotoWebPath: string | undefined;
  coverPhotoBlob: Blob | undefined;
  
  // Variable pour gérer l'état du bouton (Spinner)
  isSaving = false;

  constructor(
    private modalCtrl: ModalController,
    private api: ApiService,
    private toastCtrl: ToastController
  ) {
    addIcons({ camera, cloudUpload, save, close, shieldCheckmarkOutline, image });
  }

  ngOnInit() {
    if (this.existingChantier) {
      this.chantier = { ...this.existingChantier };
      
      // Gestion de l'image (Cloudinary ou local)
      if (this.chantier.cover_url) {
        this.coverPhotoWebPath = this.api.getFullUrl(this.chantier.cover_url);
      }
      
      // Formatage des dates pour Ionic (YYYY-MM-DD)
      if (this.chantier.date_debut) this.chantier.date_debut = String(this.chantier.date_debut).split('T')[0];
      if (this.chantier.date_fin) this.chantier.date_fin = String(this.chantier.date_fin).split('T')[0];

    } else {
      // Dates par défaut
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
        this.coverPhotoWebPath = image.webPath; // Preview immédiate
        const response = await fetch(image.webPath);
        this.coverPhotoBlob = await response.blob(); // Stockage pour envoi futur
      }
    } catch (e) {
      console.log('Prise de photo annulée');
    }
  }

  // 👇 FONCTION SAUVEGARDE SANS LoadingController
  async save() {
    if (!this.chantier.nom) {
      this.presentToast('Le nom du chantier est obligatoire', 'warning');
      return;
    }

    if (this.isSaving) return;
    this.isSaving = true; // Active le spinner sur le bouton

    // Assurer le format des dates
    const payload = { ...this.chantier };
    payload.date_debut = String(payload.date_debut).split('T')[0];
    payload.date_fin = String(payload.date_fin).split('T')[0];

    try {
      let finalChantier;

      if (this.existingChantier) {
        // 1. UPDATE
        // On utilise toPromise (ou firstValueFrom) pour attendre la réponse proprement
        finalChantier = await new Promise((resolve, reject) => {
          this.api.updateChantier(this.existingChantier.id, payload).subscribe({
            next: (res) => resolve(res),
            error: (err) => reject(err)
          });
        });
      } else {
        // 1. CREATE
        finalChantier = await new Promise((resolve, reject) => {
          this.api.createChantier(payload).subscribe({
            next: (res) => resolve(res),
            error: (err) => reject(err)
          });
        });
      }

      // 2. UPLOAD IMAGE (Si nouvelle photo et si on a un ID)
      // @ts-ignore
      if (this.coverPhotoBlob && finalChantier?.id) {
        // @ts-ignore
        await this.processImageUpload(finalChantier.id);
        // On met à jour l'URL localement pour que l'interface se mette à jour sans recharger
        // @ts-ignore
        finalChantier.cover_url = this.coverPhotoWebPath;
      }

      this.isSaving = false;
      this.modalCtrl.dismiss(finalChantier, 'confirm');

    } catch (error) {
      this.isSaving = false;
      console.error(error);
      this.presentToast('Une erreur est survenue lors de la sauvegarde.', 'danger');
    }
  }

  // Helper pour l'upload d'image
  async processImageUpload(chantierId: number): Promise<void> {
    return new Promise((resolve) => {
      const file = new File([this.coverPhotoBlob!], "cover.jpg", { type: "image/jpeg" });
      
      this.api.uploadChantierCover(chantierId, file).subscribe({
        next: (res) => {
          console.log("Cover uploadée:", res.url);
          resolve();
        },
        error: (err) => {
          console.warn("Echec upload cover", err);
          this.presentToast('Chantier sauvé mais échec de la photo', 'warning');
          resolve(); // On ne bloque pas la fermeture du modal
        }
      });
    });
  }

  async presentToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message, duration: 2000, color, position: 'bottom'
    });
    toast.present();
  }
}