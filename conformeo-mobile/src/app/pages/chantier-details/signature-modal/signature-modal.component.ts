import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { refreshOutline, checkmarkCircleOutline } from 'ionicons/icons';
import SignaturePad from 'signature_pad'; // La librairie
import { ApiService } from '../../../services/api';

@Component({
  selector: 'app-signature-modal',
  templateUrl: './signature-modal.component.html',
  styleUrls: ['./signature-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class SignatureModalComponent implements AfterViewInit {
  @ViewChild('canvas', { static: true }) canvasInfo!: ElementRef;
  signaturePad!: SignaturePad;
  chantierId!: number; // On recevra l'ID du chantier

  constructor(
    private modalCtrl: ModalController,
    private api: ApiService
  ) {
    addIcons({ refreshOutline, checkmarkCircleOutline });
  }

  ngAfterViewInit() {
    // Initialisation du Pad
    const canvas = this.canvasInfo.nativeElement;
    
    // Astuce pour la netteté sur écran rétina/mobile
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);

    this.signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)', // Fond blanc
      penColor: 'rgb(0, 0, 0)' // Encre noire
    });
  }

  clear() {
    this.signaturePad.clear();
  }

  cancel() {
    this.modalCtrl.dismiss();
  }

  async save() {
    if (this.signaturePad.isEmpty()) {
      alert("Veuillez signer avant de valider.");
      return;
    }

    // 1. Convertir le dessin en Fichier (Blob)
    const dataUrl = this.signaturePad.toDataURL('image/png');
    const blob = await (await fetch(dataUrl)).blob();

    // 2. Uploader l'image via ton API existante
    this.api.uploadPhoto(blob).subscribe({
      next: (res) => {
        const signatureUrl = res.url; // L'URL sur Render
        
        // 3. Sauvegarder l'URL dans le Chantier
        // Note: Il faut ajouter cette méthode dans l'ApiService juste après
        this.api.signChantier(this.chantierId, signatureUrl).subscribe(() => {
          this.modalCtrl.dismiss(signatureUrl, 'confirm');
        });
      },
      error: (err) => alert("Erreur lors de l'envoi")
    });
  }
}