import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonIcon, ModalController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { mapOutline, closeOutline, timeOutline, alertCircleOutline, imagesOutline } from 'ionicons/icons';
// Attention au chemin d'import, adapte-le si nécessaire selon ta structure
import { Rapport } from '../../../services/api';

@Component({
  selector: 'app-rapport-details-modal',
  template: `
    <ion-header>
      <ion-toolbar color="black">
        <ion-buttons slot="start">
          <ion-button (click)="close()">
            <ion-icon name="close-outline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>{{ rapport.titre }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding" style="--background: #000;">
      
      <div class="gallery-scroller">
        
        <ng-container *ngFor="let img of rapport.images">
           <img [src]="getFullUrl(img.url)" class="gallery-img" />
        </ng-container>

        <ng-container *ngIf="(!rapport.images || rapport.images.length === 0) && rapport.photo_url">
           <img [src]="getFullUrl(rapport.photo_url)" class="gallery-img" />
        </ng-container>

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
    /* Container du Slider */
    .gallery-container {
      margin-bottom: 20px;
      position: relative;
    }

    .gallery-scroller {
      display: flex;
      overflow-x: auto;
      gap: 10px;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .gallery-img {
      width: 85%; /* On voit un bout de la suivante */
      height: 300px;
      object-fit: cover;
      border-radius: 12px;
      flex-shrink: 0; /* Empêche l'écrasement */
    }

    .photo-counter {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.6);
      color: white;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    /* Le Slider Horizontal */
    .scrolling-wrapper {
      display: flex;
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch; /* Scroll fluide sur iOS */
      scroll-snap-type: x mandatory; /* Magnétisme */
      gap: 10px;
      height: 50vh; /* Hauteur fixe pour la visionneuse */
    }

    /* Chaque carte photo */
    .photo-card {
      flex: 0 0 100%; /* Prend toute la largeur dispo */
      scroll-snap-align: center; /* S'arrête au centre */
      width: 100%;
      height: 100%;
      background: black;
      display: flex;
      justify-content: center;
      align-items: center;
      border-radius: 12px;
      overflow: hidden;
    }

    .photo-card.empty {
      background: #333;
      color: #666;
    }

    .zoomable-image {
      width: 100%;
      height: 100%;
      object-fit: contain; /* Affiche l'image entière sans couper */
    }

    /* Reste du style inchangé */
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
    addIcons({ mapOutline, closeOutline, timeOutline, alertCircleOutline, imagesOutline });
  }

  close() {
    this.modalCtrl.dismiss();
  }

  getFullUrl(path: string) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return 'https://conformeo-api.onrender.com' + path; // Fallback pour les vieilles images locales
  }

  openMap() {
    if (this.rapport.latitude && this.rapport.longitude) {
      // Ouvre Maps ou Apple Plans
      const url = `https://www.google.com/maps/search/?api=1&query=${this.rapport.latitude},${this.rapport.longitude}`;
      window.open(url, '_system');
    }
  }
}