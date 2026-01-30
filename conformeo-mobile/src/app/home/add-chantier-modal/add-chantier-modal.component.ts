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
// 👇 AJOUTEZ TOUTES CES ICÔNES
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
    nom: '', client: '', adresse: '', est_actif: true,
    date_debut: '', date_fin: '', soumis_sps: false,
    latitude: 0, longitude: 0
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
    // 👇 ENREGISTREMENT VITAL POUR EVITER LES ERREURS URL
    addIcons({ 
      camera, cloudUpload, save, close, shieldCheckmarkOutline, image,
      searchOutline, locationSharp, trashOutline, checkboxOutline 
    });
  }

  ngOnInit() {
    const formatDate = (date: any) => {
        if (!date) return '';
        if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
        const d = new Date(date);
        return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    };

    if (this.existingChantier) {
      this.chantier = { ...this.existingChantier };
      if (this.chantier.cover_url) this.coverPhotoWebPath = this.api.getFullUrl(this.chantier.cover_url);
      this.chantier.date_debut = formatDate(this.chantier.date_debut);
      this.chantier.date_fin = formatDate(this.chantier.date_fin);
    } else {
      const today = new Date();
      const nextMonth = new Date(); nextMonth.setDate(today.getDate() + 30);
      this.chantier.date_debut = formatDate(today);
      this.chantier.date_fin = formatDate(nextMonth);
    }
  }

  cancel() { this.modalCtrl.dismiss(null, 'cancel'); }

  async takeCoverPhoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 80, allowEditing: false, resultType: CameraResultType.Uri, source: CameraSource.Camera
      });
      if (image.webPath) {
        this.coverPhotoWebPath = image.webPath;
        const response = await fetch(image.webPath);
        this.coverPhotoBlob = await response.blob();
      }
    } catch (e) {}
  }

  searchAddress(ev: any) {
    const query = ev.target.value;
    if (query && query.length > 3) {
      this.api.http.get(`${this.api.apiUrl}/tools/search-address?q=${query}`).subscribe({
          next: (data: any) => this.addressSuggestions = data,
          error: (err) => console.error(err)
      });
    } else { this.addressSuggestions = []; }
  }

  selectAddress(addr: any) {
    this.chantier.adresse = addr.label; 
    this.chantier.latitude = Number(addr.latitude);
    this.chantier.longitude = Number(addr.longitude);
    this.addressSuggestions = [];
  }

  async save() {
    if (!this.chantier.nom) return this.presentToast('Nom obligatoire', 'warning');
    if (this.isSaving) return;
    this.isSaving = true;

    const payload: any = { ...this.chantier };
    // Dates vides -> null
    payload.date_debut = payload.date_debut ? String(payload.date_debut).split('T')[0] : null;
    payload.date_fin = payload.date_fin ? String(payload.date_fin).split('T')[0] : null;

    try {
      let final: any;
      if (this.existingChantier) {
        final = await new Promise((resolve, reject) => {
          this.api.updateChantier(this.existingChantier.id, payload).subscribe({ next: resolve, error: reject });
        });
      } else {
        final = await new Promise((resolve, reject) => {
          this.api.createChantier(payload).subscribe({ next: resolve, error: reject });
        });
      }

      if (this.coverPhotoBlob && final?.id) {
        await this.processImageUpload(final.id);
      }
      this.isSaving = false;
      this.modalCtrl.dismiss(final, 'confirm');
    } catch (error) {
      this.isSaving = false;
      console.error(error);
      this.presentToast('Erreur sauvegarde', 'danger');
    }
  }

  async deleteChantier() {
    if (!confirm('Supprimer définitivement ?')) return;
    this.api.deleteChantier(this.existingChantier.id).subscribe({
      next: () => this.modalCtrl.dismiss(null, 'delete'),
      error: () => this.presentToast('Erreur suppression', 'danger')
    });
  }

  async processImageUpload(id: number): Promise<void> {
    return new Promise((resolve) => {
      const file = new File([this.coverPhotoBlob!], "cover.jpg", { type: "image/jpeg" });
      this.api.uploadChantierCover(id, file).subscribe({ next: () => resolve(), error: () => resolve() });
    });
  }

  async presentToast(msg: string, color: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, color, position: 'bottom' });
    t.present();
  }
}