import { Component, Input, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';

// Import de Swiper Bundle (inclut le Zoom)
import { register } from 'swiper/element/bundle';
register();

@Component({
  selector: 'app-image-viewer-modal',
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar style="--background: transparent; position: absolute; top: 0; z-index: 10;">
        <ion-buttons slot="end">
          <ion-button (click)="close()" color="light" style="background: rgba(0,0,0,0.6); border-radius: 50%; width: 40px; height: 40px;">
            <ion-icon name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content style="--background: #000;">
      
      <swiper-container 
        [zoom]="true" 
        zoom-max-ratio="5" 
        [pagination]="true" 
        style="height: 100%; width: 100%;"
      >
        <swiper-slide>
          <div class="swiper-zoom-container">
            <img [src]="imageUrl" />
          </div>
        </swiper-slide>
      </swiper-container>

    </ion-content>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      background: black;
    }
    
    swiper-container {
      --swiper-navigation-color: #fff;
      --swiper-pagination-color: #fff;
    }

    /* Le conteneur de zoom doit prendre toute la place */
    .swiper-zoom-container {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain; /* L'image s'adapte sans être coupée */
    }
  `],
  standalone: true,
  imports: [CommonModule, IonicModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ImageViewerModalComponent {
  @Input() imageUrl!: string;

  constructor(private modalCtrl: ModalController) {
    addIcons({ closeOutline });
  }

  close() {
    this.modalCtrl.dismiss();
  }
}