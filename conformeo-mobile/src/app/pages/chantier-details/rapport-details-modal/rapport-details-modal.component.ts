import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonIcon, IonImg, IonLabel, IonItem, IonList, 
  IonCard, IonCardContent, ModalController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { mapOutline, closeOutline, timeOutline, alertCircleOutline } from 'ionicons/icons';
import { Rapport } from '../../../services/api'
@Component({
  selector: 'app-rapport-details-modal',
  template: `
    <ion-header>
      <ion-toolbar color="black"> <ion-buttons slot="start">
          <ion-button (click)="close()">
            <ion-icon name="close-outline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>{{ rapport.titre }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding" style="--background: #000;">
      
      <div class="photo-container" *ngIf="rapport.photo_url">
        <img [src]="getFullUrl(rapport.photo_url)" class="fullscreen-image" />
      </div>

      <div class="details-container">
        
        <div class="badge-row">
          <span class="badge" [class]="rapport.niveau_urgence || 'Faible'">
            {{ rapport.niveau_urgence || 'Faible' }}
          </span>
          <span class="date">
            <ion-icon name="time-outline"></ion-icon>
            {{ rapport.date_creation | date:'dd/MM/yyyy HH:mm' }}
          </span>
        </div>

        <h2 class="description-title">Observation</h2>
        <p class="description-text">{{ rapport.description }}</p>

        <div *ngIf="rapport.latitude" class="map-section">
          <ion-button expand="block" color="secondary" (click)="openMap()">
            <ion-icon name="map-outline" slot="start"></ion-icon>
            Voir la position exacte
          </ion-button>
          <p class="gps-text">
            GPS: {{ rapport.latitude | number:'1.5-5' }}, {{ rapport.longitude | number:'1.5-5' }}
          </p>
        </div>

      </div>
    </ion-content>
  `,
  styles: [`
    .photo-container {
      width: 100%;
      height: 50vh; /* La moitié de l'écran */
      background: black;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .fullscreen-image {
      width: 100%;
      height: 100%;
      object-fit: contain; /* L'image entière est visible */
    }
    .details-container {
      background: #1e1e1e;
      border-radius: 16px;
      padding: 20px;
      color: white;
    }
    .badge-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    .badge {
      padding: 5px 12px;
      border-radius: 20px;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 12px;
    }
    /* Couleurs des badges */
    .Faible { background: #2dd36f; color: black; }
    .Moyen { background: #ffc409; color: black; }
    .Critique { background: #eb445a; color: white; }

    .date { color: #aaa; font-size: 14px; display: flex; align-items: center; gap: 5px; }
    .description-title { margin: 0 0 10px 0; font-size: 18px; font-weight: bold; }
    .description-text { color: #ddd; line-height: 1.5; font-size: 16px; margin-bottom: 20px;}
    .gps-text { text-align: center; color: #666; font-size: 12px; margin-top: 10px; }
  `],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonButtons, IonButton, IonContent, IonIcon, IonTitle]
})
export class RapportDetailsModalComponent {
  @Input() rapport!: Rapport;

  constructor(private modalCtrl: ModalController) {
    addIcons({ mapOutline, closeOutline, timeOutline, alertCircleOutline });
  }

  close() {
    this.modalCtrl.dismiss();
  }

  getFullUrl(path: string) {
    if (path.startsWith('http')) return path;
    // Remplace par ton URL render si besoin, mais normalement c'est déjà une URL Cloudinary
    return path; 
  }

  openMap() {
    if (this.rapport.latitude && this.rapport.longitude) {
      // Ouvre l'application de carte native (Apple Maps ou Google Maps)
      const url = `https://www.google.com/maps/search/?api=1&query=${this.rapport.latitude},${this.rapport.longitude}`;
      window.open(url, '_system');
    }
  }
}