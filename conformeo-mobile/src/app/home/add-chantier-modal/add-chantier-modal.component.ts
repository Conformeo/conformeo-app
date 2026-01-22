import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// 👇 IMPORT DES COMPOSANTS IONIC
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonList, IonItem, IonInput, ModalController,
  IonIcon, IonSpinner, IonLabel, IonListHeader, 
  IonToggle, IonNote, LoadingController, ToastController 
} from '@ionic/angular/standalone';

import { ApiService, Chantier } from '../../services/api';
import { addIcons } from 'ionicons';

// 👇 AJOUT DES ICONES
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
    IonLabel, IonListHeader, IonToggle, IonNote
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
  
  // Utilisation pour l'affichage conditionnel du chargement
  isLoading = false;

  constructor(
    private modalCtrl: ModalController,
    private api: ApiService,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {
    addIcons({ camera, cloudUpload, save, close, shieldCheckmarkOutline, image });
  }

  ngOnInit() {
    if (this.existingChantier) {
      // Clone pour ne pas modifier l'affichage dessous avant confirmation
      this.chantier = { ...this.existingChantier };
      
      // Gestion de l'affichage de l'image existante
      // On utilise getFullUrl pour que l'image s'affiche correctement (Cloudinary ou local)
      if (this.chantier.cover_url) {
        this.coverPhotoWebPath = this.api.getFullUrl(this.chantier.cover_url);
      }
      
      // Formatage des dates pour les inputs HTML (YYYY-MM-DD)
      if (this.chantier.date_debut) {
        const d = new Date(this.chantier.date_debut);
        this.chantier.date_debut = d.toISOString().split('T')[0];
      }
      if (this.chantier.date_fin) {
        const d = new Date(this.chantier.date_fin);
        this.chantier.date_fin = d.toISOString().split('T')[0];
      }
    } else {
      // Initialisation des dates par défaut
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
        this.coverPhotoBlob = await response.blob(); // Stockage pour envoi
      }
    } catch (e) {
      console.log('Prise de photo annulée');
    }
  }

  // 👇 FONCTION DE SAUVEGARDE CORRIGÉE
  async save() {
    if (!this.chantier.nom) {
      this.presentToast('Le nom du chantier est obligatoire', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Sauvegarde...' });
    await loading.present();

    if (this.existingChantier) {
      // 1. UPDATE TEXTE
      this.api.updateChantier(this.existingChantier.id, this.chantier).subscribe({
        next: async (res) => {
          // 2. SI NOUVELLE PHOTO -> UPLOAD
          if (this.coverPhotoBlob) {
            await this.processImageUpload(this.existingChantier.id);
            // On met à jour l'URL locale pour le retour
            res.cover_url = this.coverPhotoWebPath; 
          }
          
          loading.dismiss();
          this.modalCtrl.dismiss(res, 'confirm');
        },
        error: (err) => {
          loading.dismiss();
          console.error(err);
          this.presentToast('Erreur modification', 'danger');
        }
      });

    } else {
      // 1. CREATION
      this.api.createChantier(this.chantier).subscribe({
        next: async (newChantier) => {
          // 2. SI PHOTO -> UPLOAD (Maintenant qu'on a l'ID)
          if (this.coverPhotoBlob && newChantier.id) {
            await this.processImageUpload(newChantier.id);
          }
          
          loading.dismiss();
          this.modalCtrl.dismiss(newChantier, 'confirm');
        },
        error: (err) => {
          loading.dismiss();
          console.error(err);
          this.presentToast('Erreur création', 'danger');
        }
      });
    }
  }

  // Helper pour gérer l'upload d'image proprement
  async processImageUpload(chantierId: number): Promise<void> {
    return new Promise((resolve) => {
      // On transforme le Blob en File pour l'envoyer
      const file = new File([this.coverPhotoBlob!], "cover.jpg", { type: "image/jpeg" });

      this.api.uploadChantierCover(chantierId, file).subscribe({
        next: (res) => {
          console.log("Cover uploadée:", res.url);
          resolve();
        },
        error: (err) => {
          console.warn("Echec upload cover", err);
          this.presentToast('Chantier sauvé mais échec image', 'warning');
          resolve(); // On continue quand même
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