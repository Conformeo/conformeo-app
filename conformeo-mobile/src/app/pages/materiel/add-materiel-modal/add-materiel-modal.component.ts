import { Component, Input, OnInit } from '@angular/core'; // <--- Ajout Input, OnInit
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonContent, IonList, IonItem, IonInput, IonLabel, 
  IonIcon, IonSpinner, ModalController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, save, camera, image } from 'ionicons/icons';
import { ApiService } from 'src/app/services/api'; // Assurez-vous du chemin (.service)
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { removeBackground } from '@imgly/background-removal';

@Component({
  selector: 'app-add-materiel-modal',
  templateUrl: './add-materiel-modal.component.html',
  styleUrls: ['./add-materiel-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonInput, IonLabel, IonIcon, IonSpinner]
})
export class AddMaterielModalComponent implements OnInit {
  
  // 👇 OBJET A MODIFIER (OPTIONNEL)
  @Input() existingItem: any = null;

  data = { nom: '', reference: '' };
  processedImage: string | null = null;
  imageBlob: Blob | null = null;
  
  isProcessing = false;
  isSaving = false; 

  constructor(private modalCtrl: ModalController, private api: ApiService) {
    addIcons({ close, save, camera, image });
  }

  // 👇 INITIALISATION : On remplit si on modifie
  ngOnInit() {
    if (this.existingItem) {
      this.data.nom = this.existingItem.nom;
      this.data.reference = this.existingItem.reference;
      
      // On affiche l'image existante si pas de nouvelle photo
      if (this.existingItem.image_url) {
        this.processedImage = this.existingItem.image_url;
      }
    }
  }

  async takePicture() {
    try {
      const image = await Camera.getPhoto({
        quality: 90, allowEditing: false, resultType: CameraResultType.Uri, source: CameraSource.Camera, correctOrientation: true
      });
      if (image.webPath) {
        this.processImage(image.webPath);
      }
    } catch (e) { console.log("Annulé"); }
  }

  async processImage(path: string) {
    this.isProcessing = true;
    try {
        const response = await fetch(path);
        const originalBlob = await response.blob();
        const blobSansFond = await removeBackground(originalBlob);
        
        this.imageBlob = blobSansFond;
        this.processedImage = URL.createObjectURL(blobSansFond);
        
    } catch (error) {
        console.error(error);
        alert("Erreur détourage");
    } finally {
        this.isProcessing = false;
    }
  }

  cancel() { this.modalCtrl.dismiss(null, 'cancel'); }

  save() {
    if (this.isSaving) return;
    this.isSaving = true;

    // CAS 1 : On a pris une NOUVELLE photo -> Upload d'abord
    if (this.imageBlob) {
      const fileToUpload = new File([this.imageBlob], "materiel.png", { type: "image/png" });

      this.api.uploadPhoto(fileToUpload).subscribe({
        next: (res) => {
           // On sauvegarde avec la NOUVELLE URL
           this.finalizeSave(res.url);
        },
        error: (err) => {
          this.isSaving = false;
          alert("Erreur upload image");
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
      etat: 'Bon', // Vous pourrez ajouter un champ pour l'état plus tard
      image_url: imageUrl
    };

    if (this.existingItem) {
      // --- MODE MODIFICATION ---
      this.api.updateMateriel(this.existingItem.id, matData).subscribe({
        next: () => {
          this.modalCtrl.dismiss(true, 'confirm');
        },
        error: () => {
          this.isSaving = false;
          alert("Erreur lors de la modification");
        }
      });
    } else {
      // --- MODE CRÉATION ---
      this.api.createMateriel(matData).subscribe({
        next: () => {
          this.modalCtrl.dismiss(true, 'confirm');
        },
        error: () => {
          this.isSaving = false;
          alert("Erreur lors de la création");
        }
      });
    }
  }
}