import { Component, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonIcon, ModalController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { mapOutline, closeOutline, timeOutline, alertCircleOutline } from 'ionicons/icons';
import { Rapport } from 'src/app/services/api';
import { ImageViewerModalComponent } from '../image-viewer-modal/image-viewer-modal.component';

// 👇 ON ACTIVE LE MOTEUR SWIPER
import { register } from 'swiper/element/bundle';
register();

@Component({
  selector: 'app-rapport-details-modal',
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="black">
        <ion-buttons slot="start">
          <ion-button (click)="close()">
            <ion-icon name="close-outline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>{{ rapport.titre }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content style="--background: #000;">
      
      <div class="gallery-section">
        
        <swiper-container 
          slides-per-view="1.1" 
          space-between="10" 
          centered-slides="true"
          pagination="true"
        >
          
          <swiper-slide *ngFor="let img of rapport.images">
             <img [src]="getFullUrl(img.url)" class="slide-img" (click)="zoomImage(img.url)" />
          </swiper-slide>

          <swiper-slide *ngIf="(!rapport.images || rapport.images.length === 0) && rapport.photo_url">
             <img [src]="getFullUrl(rapport.photo_url)" class="slide-img" (click)="zoomImage(rapport.photo_url)" />
          </swiper-slide>

        </swiper-container>

      </div>

      <div class="details-section">
        
        <div class="badge-row">
          <span class="badge" [class]="rapport.niveau_urgence || 'Faible'">
            {{ rapport.niveau_urgence || 'Faible' }}
          </span>
          <span class="date">
            <ion-icon name="time-outline"></ion-icon>
            {{ rapport.date_creation | date:'dd/MM HH:mm' }}
          </span>
        </div>

        <h2 class="description-title">Observation</h2>
        <p class="description-text">{{ rapport.description }}</p>

        <div *ngIf="rapport.latitude" class="map-section">
          <ion-button expand="block" color="secondary" (click)="openMap()">
            <ion-icon name="map-outline" slot="start"></ion-icon>
            Voir la position
          </ion-button>
        </div>

      </div>
    </ion-content>
  `,
  styles: [`
    .gallery-section {
      background: #000;
      padding-top: 20px;
      padding-bottom: 20px;
    }

    swiper-container {
      width: 100%;
      height: 350px; /* Hauteur fixe pour la zone de slide */
      --swiper-pagination-color: #fff;
      --swiper-pagination-bullet-inactive-color: #666;
    }

    .slide-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 12px;
      border: 1px solid #333;
      background: #111;
    }

    /* DETAILS */
    .details-section {
      background: #1e1e1e;
      border-top-left-radius: 24px;
      border-top-right-radius: 24px;
      padding: 25px;
      color: white;
      min-height: 300px;
      position: relative;
    }

    .badge-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .badge { padding: 6px 14px; border-radius: 20px; font-weight: 800; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
    .Faible { background: #2dd36f; color: black; }
    .Moyen { background: #ffc409; color: black; }
    .Critique { background: #eb445a; color: white; }
    
    .date { color: #aaa; font-size: 13px; display: flex; align-items: center; gap: 5px; }
    .description-title { margin: 0 0 10px 0; font-size: 20px; font-weight: 700; color: #fff; }
    .description-text { color: #ccc; line-height: 1.6; font-size: 16px; margin-bottom: 30px; white-space: pre-wrap; }
  `],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonButtons, IonButton, IonContent, IonIcon],
  // 👇 INDISPENSABLE POUR QUE ANGULAR ACCEPTE <swiper-container>
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class RapportDetailsModalComponent {
  @Input() rapport!: Rapport;

  constructor(private modalCtrl: ModalController) {
    addIcons({ mapOutline, closeOutline, timeOutline, alertCircleOutline });
  }

  close() { this.modalCtrl.dismiss(); }

  getFullUrl(path: string) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return 'https://conformeo-api.onrender.com' + path;
  }

  async zoomImage(url: string) {
    const modal = await this.modalCtrl.create({
      component: ImageViewerModalComponent,
      componentProps: { imageUrl: this.getFullUrl(url) }
    });
    modal.present();
  }

  openMap() {
    if (this.rapport.latitude) {
      const url = `http://googleusercontent.com/maps.google.com/?q=${this.rapport.latitude},${this.rapport.longitude}`;
      window.open(url, '_system');
    }
  }
}