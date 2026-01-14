import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonList, IonItem, IonInput, IonLabel, 
  IonIcon, IonSpinner, ModalController, IonSelect, IonSelectOption 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, save, camera, image } from 'ionicons/icons';
import { ApiService } from 'src/app/services/api'; // Ensure correct path
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import { removeBackground } from '@imgly/background-removal';

@Component({
  selector: 'app-add-materiel-modal',
  templateUrl: './add-materiel-modal.component.html',
  styleUrls: ['./add-materiel-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
    IonContent, IonList, IonItem, IonInput, IonLabel, 
    IonIcon, IonSpinner, IonSelect, IonSelectOption 
  ]
})
export class AddMaterielModalComponent implements OnInit {
  
  @Input() existingItem: any = null;

  data = {
    nom: '',
    reference: '',
    etat: 'Bon', // Physical state (manual)
    image_url: ''
  };
  
  processedImage: string | null = null;
  imageBlob: Blob | null = null;
  
  isProcessing = false;
  isSaving = false; 

  constructor(
    private modalCtrl: ModalController, 
    private api: ApiService
  ) {
    addIcons({ close, save, camera, image });
  }

  ngOnInit() {
    if (this.existingItem) {
      this.data = {
        nom: this.existingItem.nom,
        reference: this.existingItem.reference,
        etat: this.existingItem.etat || 'Bon',
        image_url: this.existingItem.image_url
      };
      this.processedImage = this.existingItem.image_url;
    }
  }

  async takePicture() {
    try {
      const image = await Camera.getPhoto({
        quality: 90, 
        allowEditing: false, 
        resultType: CameraResultType.Uri, 
        source: CameraSource.Camera, 
        correctOrientation: true
      });

      if (image.webPath) {
        this.processImage(image.webPath);
      }
    } catch (e) { 
      console.log("Annulé"); 
    }
  }

  async processImage(path: string) {
    this.isProcessing = true;
    try {
        const response = await fetch(path);
        const originalBlob = await response.blob();
        
        // AI Background Removal
        const blobSansFond = await removeBackground(originalBlob);
        
        this.imageBlob = blobSansFond;
        this.processedImage = URL.createObjectURL(blobSansFond);
        
    } catch (error) {
        console.error(error);
        alert("Erreur lors du détourage IA");
    } finally {
        this.isProcessing = false;
    }
  }

  cancel() { 
    this.modalCtrl.dismiss(null, 'cancel'); 
  }

  save() {
    if (this.isSaving) return;
    this.isSaving = true;

    // Case 1: New photo -> Upload first
    if (this.imageBlob) {
      const fileToUpload = new File([this.imageBlob], "materiel_ia.png", { type: "image/png" });

      this.api.uploadPhoto(fileToUpload).subscribe({
        next: (res) => {
           this.finalizeSave(res.url);
        },
        error: (err) => {
          this.isSaving = false;
          console.error(err);
          alert("Erreur lors de l'envoi de la photo");
        }
      });
    } 
    // Case 2: No new photo -> Keep old URL
    else {
      const oldUrl = this.existingItem ? this.existingItem.image_url : null;
      this.finalizeSave(oldUrl);
    }
  }

  finalizeSave(imageUrl: string | null) {
    const matData: any = {
      nom: this.data.nom,
      reference: this.data.reference,
      etat: this.data.etat,
      image_url: imageUrl,
      // 👇 IMPORTANT: Add required field for TypeScript/Backend validation
      statut_vgp: this.existingItem ? this.existingItem.statut_vgp : 'INCONNU' 
    };

    if (this.existingItem) {
      // UPDATE
      this.api.updateMateriel(this.existingItem.id, matData).subscribe({
        next: () => {
          this.modalCtrl.dismiss(true, 'confirm');
        },
        error: (err) => {
          this.isSaving = false;
          console.error(err);
          alert("Erreur lors de la modification");
        }
      });
    } else {
      // CREATE
      this.api.createMateriel(matData).subscribe({
        next: () => {
          this.modalCtrl.dismiss(true, 'confirm');
        },
        error: (err) => {
          this.isSaving = false;
          console.error(err);
          alert("Erreur lors de la création");
        }
      });
    }
  }
}