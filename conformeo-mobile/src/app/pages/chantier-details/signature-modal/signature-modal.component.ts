import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { refreshOutline, checkmarkCircleOutline } from 'ionicons/icons';
import SignaturePad from 'signature_pad';
import { ApiService } from '../../../services/api';

@Component({
  selector: 'app-signature-modal',
  templateUrl: './signature-modal.component.html',
  styleUrls: ['./signature-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class SignatureModalComponent implements AfterViewInit {
  @ViewChild('canvas', { static: false }) canvasInfo!: ElementRef;
  signaturePad!: SignaturePad;
  chantierId!: number;

  constructor(
    private modalCtrl: ModalController,
    private api: ApiService
  ) {
    addIcons({ refreshOutline, checkmarkCircleOutline });
  }

  ngAfterViewInit() {
    // 👇 ON ATTEND 500ms QUE LA MODALE SOIT OUVERTE
    setTimeout(() => {
      this.initPad();
    }, 500);
  }

  initPad() {
    const canvas = this.canvasInfo.nativeElement;
    
    // Fonction pour gérer la résolution (Retina display, etc.)
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    
    // On définit la taille réelle du dessin
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    
    // On demande au contexte 2D de s'adapter
    canvas.getContext("2d").scale(ratio, ratio);

    this.signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
      minWidth: 2, // Trait un peu plus épais pour être visible
      maxWidth: 4
    });
    
    // Petite astuce : on efface tout de suite pour être sûr que c'est propre
    this.signaturePad.clear(); 
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

    // On réduit un peu la taille de l'image pour l'upload (optionnel mais mieux pour la perf)
    const dataUrl = this.signaturePad.toDataURL('image/png');
    
    // Conversion DataURL -> Blob
    const blob = await (await fetch(dataUrl)).blob();

    // Upload
    this.api.uploadPhoto(blob).subscribe({
      next: (res) => {
        const signatureUrl = res.url;
        
        this.api.signChantier(this.chantierId, signatureUrl).subscribe(() => {
          this.modalCtrl.dismiss(signatureUrl, 'confirm');
        });
      },
      error: (err) => alert("Erreur lors de l'envoi")
    });
  }
}