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
// 👇 AJOUT DE 'checkboxOutline' pour corriger l'erreur console
import { 
  camera, cloudUpload, save, close, shieldCheckmarkOutline, image,
  searchOutline, locationSharp, trashOutline, checkboxOutline 
} from 'ionicons/icons';

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
    date_debut: '',
    date_fin: '',
    soumis_sps: false,
    latitude: 0,
    longitude: 0
  };

  coverPhotoWebPath: string | undefined;
  coverPhotoBlob: Blob | undefined;
  isSaving = false;
  addressSuggestions: any[] = [];

  constructor(
    private modalCtrl: ModalController,
    public api: ApiService, 
    private toastCtrl: ToastController
  ) {
    // 👇 ENREGISTREMENT DE TOUTES LES ICÔNES NÉCESSAIRES
    addIcons({ 
      camera, cloudUpload, save, close, shieldCheckmarkOutline, image,
      searchOutline, locationSharp, trashOutline, checkboxOutline 
    });
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

  // 👇 AUTOCOMPLÉTION ADRESSE
  searchAddress(ev: any) {
    const query = ev.target.value;
    if (query && query.length > 3) {
      this.api.http.get(`${this.api.apiUrl}/tools/search-address?q=${query}`)
        .subscribe({
          next: (data: any) => {
            this.addressSuggestions = data;
          },
          error: (err) => console.error("Erreur recherche adresse", err)
        });
    } else {
      this.addressSuggestions = [];
    }
  }

  // 👇 SÉLECTION D'UNE SUGGESTION (Important pour le GPS)
  selectAddress(addr: any) {
    this.chantier.adresse = addr.label; 
    
    // On force la conversion en nombre pour éviter les erreurs backend
    this.chantier.latitude = Number(addr.latitude);
    this.chantier.longitude = Number(addr.longitude);
    
    this.addressSuggestions = [];
  }

  async save() {
    if (!this.chantier.nom) {
      this.presentToast('Le nom du chantier est obligatoire', 'warning');
      return;
    }

    if (this.isSaving) return;
    this.isSaving = true;

    const payload: any = { ...this.chantier };
    
    // Nettoyage des dates pour éviter les strings vides ou invalides
    payload.date_debut = payload.date_debut ? String(payload.date_debut).split('T')[0] : null;
    payload.date_fin = payload.date_fin ? String(payload.date_fin).split('T')[0] : null;

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

      // UPLOAD IMAGE (si nouvelle photo prise)
      if (this.coverPhotoBlob && finalChantier?.id) {
        await this.processImageUpload(finalChantier.id);
        // On ne met pas à jour l'URL locale, la modal va se fermer
      }

      this.isSaving = false;
      this.modalCtrl.dismiss(finalChantier, 'confirm');

    } catch (error) {
      this.isSaving = false;
      console.error("Erreur Sauvegarde:", error);
      // Message plus clair pour l'utilisateur
      this.presentToast('Erreur serveur. Vérifiez votre connexion.', 'danger');
    }
  }

  async deleteChantier() {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce chantier définitivement ?')) return;
    
    this.api.deleteChantier(this.existingChantier.id).subscribe({
      next: () => {
        this.presentToast('Chantier supprimé', 'success');
        this.modalCtrl.dismiss(null, 'delete');
      },
      error: (err) => {
        console.error(err);
        this.presentToast('Erreur lors de la suppression', 'danger');
      }
    });
  }

  async processImageUpload(chantierId: number): Promise<void> {
    return new Promise((resolve) => {
      const file = new File([this.coverPhotoBlob!], "cover.jpg", { type: "image/jpeg" });
      
      this.api.uploadChantierCover(chantierId, file).subscribe({
        next: (res) => { resolve(); },
        error: (err) => { resolve(); } // On continue même si l'image échoue
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