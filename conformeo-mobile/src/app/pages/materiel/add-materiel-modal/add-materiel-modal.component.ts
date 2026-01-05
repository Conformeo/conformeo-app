import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonList, IonItem, IonInput, IonLabel, 
  IonIcon, IonSpinner, ModalController, IonSelect, IonSelectOption, LoadingController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, save, camera, image } from 'ionicons/icons';
import { ApiService } from '../../../services/api'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { removeBackground } from '@imgly/background-removal';

@Component({
  selector: 'app-add-materiel-modal',
  templateUrl: './add-materiel-modal.component.html',
  styleUrls: ['./add-materiel-modal.component.scss'],
  standalone: true,
  // 👇 AJOUT DE IonSelect ICI
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
    etat: 'Bon', // Valeur par défaut
    image_url: ''
  };
  
  processedImage: string | null = null;
  imageBlob: Blob | null = null;
  
  isProcessing = false;
  isSaving = false; 

  constructor(
    private modalCtrl: ModalController, 
    private api: ApiService,
    private loadingCtrl: LoadingController
  ) {
    addIcons({ close, save, camera, image });
  }

  ngOnInit() {
    if (this.existingItem) {
      // Si on modifie, on reprend les infos existantes
      this.data = {
        nom: this.existingItem.nom,
        reference: this.existingItem.reference,
        etat: this.existingItem.etat || 'Bon', // Récupération de l'état
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
        
        // ✨ Magie du détourage
        const blobSansFond = await removeBackground(originalBlob);
        
        this.imageBlob = blobSansFond;
        this.processedImage = URL.createObjectURL(blobSansFond);
        
    } catch (error) {
        console.error(error);
        // Fallback : si erreur IA, on garde l'image normale ?
        // Pour l'instant on alerte juste
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

    // CAS 1 : On a pris une NOUVELLE photo -> Upload d'abord
    if (this.imageBlob) {
      // On convertit le Blob en File pour l'upload
      const fileToUpload = new File([this.imageBlob], "materiel_ia.png", { type: "image/png" });

      this.api.uploadPhoto(fileToUpload).subscribe({
        next: (res) => {
           // On sauvegarde avec la NOUVELLE URL Cloudinary
           this.finalizeSave(res.url);
        },
        error: (err) => {
          this.isSaving = false;
          console.error(err);
          alert("Erreur lors de l'envoi de la photo");
        }
      });
    } 
    // CAS 2 : Pas de nouvelle photo -> On garde l'ancienne (ou rien)
    else {
      const oldUrl = this.existingItem ? this.existingItem.image_url : null;
      this.finalizeSave(oldUrl);
    }
  }

  // 👇 FONCTION COMMUNE (CRÉATION OU UPDATE)
  finalizeSave(imageUrl: string | null) {
    const matData = {
      nom: this.data.nom,
      reference: this.data.reference,
      etat: this.data.etat, // 🟢 CORRECTION : On utilise la valeur du formulaire !
      image_url: imageUrl
    };

    if (this.existingItem) {
      // --- MODE MODIFICATION ---
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
      // --- MODE CRÉATION ---
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