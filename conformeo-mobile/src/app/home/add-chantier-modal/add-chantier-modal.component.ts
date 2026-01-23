import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonList, IonItem, IonInput, ModalController,
  IonIcon, IonSpinner, IonLabel, IonListHeader, 
  IonToggle, IonNote, ToastController
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
    IonLabel, IonListHeader, IonToggle, IonNote
  ]
})
export class AddChantierModalComponent implements OnInit {

  @Input() existingChantier: any = null;

  // Initialisation propre
  chantier: Chantier = {
    nom: '',
    client: '',
    adresse: '',
    est_actif: true,
    date_debut: '',
    date_fin: '',
    soumis_sps: false
  };

  coverPhotoWebPath: string | undefined;
  coverPhotoBlob: Blob | undefined;
  isSaving = false;

  constructor(
    private modalCtrl: ModalController,
    private api: ApiService,
    private toastCtrl: ToastController
  ) {
    addIcons({ camera, cloudUpload, save, close, shieldCheckmarkOutline, image });
  }

  ngOnInit() {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setDate(today.getDate() + 30);

    // Helper pour formater YYYY-MM-DD
    const formatDate = (date: any) => {
        if (!date) return '';
        if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().split('T')[0];
    };

    if (this.existingChantier) {
      this.chantier = { ...this.existingChantier };
      
      if (this.chantier.cover_url) {
        this.coverPhotoWebPath = this.api.getFullUrl(this.chantier.cover_url);
      }
      
      this.chantier.date_debut = formatDate(this.chantier.date_debut);
      this.chantier.date_fin = formatDate(this.chantier.date_fin);

    } else {
      this.chantier.date_debut = formatDate(today);
      this.chantier.date_fin = formatDate(nextMonth);
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

  async save() {
    if (!this.chantier.nom) {
      this.presentToast('Le nom du chantier est obligatoire', 'warning');
      return;
    }

    if (this.isSaving) return;
    this.isSaving = true;

    // Payload propre
    // On force le typage as 'any' temporairement pour manipuler les champs optionnels
    // ou on respecte l'interface en mettant undefined
    const payload: any = { ...this.chantier };
    
    // 👇 CORRECTION ICI : Utiliser undefined au lieu de null
    // Si la date est vide, on l'enlève ou on met undefined
    payload.date_debut = payload.date_debut ? String(payload.date_debut).split('T')[0] : undefined;
    payload.date_fin = payload.date_fin ? String(payload.date_fin).split('T')[0] : undefined;

    try {
      let finalChantier: any;

      if (this.existingChantier) {
        // UPDATE
        finalChantier = await new Promise((resolve, reject) => {
          this.api.updateChantier(this.existingChantier.id, payload).subscribe({
            next: (res) => resolve(res),
            error: (err) => reject(err)
          });
        });
      } else {
        // CREATE
        finalChantier = await new Promise((resolve, reject) => {
          this.api.createChantier(payload).subscribe({
            next: (res) => resolve(res),
            error: (err) => reject(err)
          });
        });
      }

      // UPLOAD IMAGE
      if (this.coverPhotoBlob && finalChantier?.id) {
        await this.processImageUpload(finalChantier.id);
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

  async deleteChantier() {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce chantier définitivement ?')) return;
    
    this.api.deleteChantier(this.existingChantier.id).subscribe({
      next: () => {
        this.modalCtrl.dismiss(null, 'delete'); // On ferme et on signale la suppression
      },
      error: (err) => alert("Erreur lors de la suppression")
    });
  }

  async processImageUpload(chantierId: number): Promise<void> {
    return new Promise((resolve) => {
      const file = new File([this.coverPhotoBlob!], "cover.jpg", { type: "image/jpeg" });
      
      this.api.uploadChantierCover(chantierId, file).subscribe({
        next: (res) => { resolve(); },
        error: (err) => { resolve(); }
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