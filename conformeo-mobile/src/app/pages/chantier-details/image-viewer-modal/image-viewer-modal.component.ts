import { Component, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';

// Import de Swiper (la mécanique de zoom)
import { register } from 'swiper/element/bundle';
register();

@Component({
  selector: 'app-image-viewer-modal',
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar style="--background: transparent; position: absolute; top: 0; z-index: 10;">
        <ion-buttons slot="end">
          <ion-button (click)="close()" color="light" style="background: rgba(0,0,0,0.5); border-radius: 50%;">
            <ion-icon name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content style="--background: #000;">
      <swiper-container 
        [zoom]="true" 
        [pagination]="true" 
        style="height: 100%;"
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
      --background: #000;
    }
    swiper-container {
      --swiper-navigation-color: #fff;
      --swiper-pagination-color: #fff;
    }
    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  `],
  standalone: true,
  imports: [CommonModule, IonicModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA] // <--- Indispensable pour Swiper
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