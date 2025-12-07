import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, 
  IonInput, IonLabel, IonButton, IonIcon, IonThumbnail, IonSpinner,
  IonButtons, IonMenuButton, // 👈 AJOUTS ICI (Les imports manquants)
  ToastController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { saveOutline, cloudUploadOutline, businessOutline, callOutline, mailOutline } from 'ionicons/icons';
import { ApiService } from 'src/app/services/api';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

@Component({
  selector: 'app-parametres',
  templateUrl: './parametres.page.html',
  styleUrls: ['./parametres.page.scss'],
  standalone: true,
  // 👇 AJOUTEZ-LES AUSSI DANS CETTE LISTE
  imports: [
    CommonModule, 
    FormsModule, 
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonContent, 
    IonList, 
    IonItem, 
    IonInput, 
    IonLabel, 
    IonButton, 
    IonIcon, 
    IonThumbnail, 
    IonSpinner,
    IonButtons,     // <--- ICI
    IonMenuButton   // <--- ET ICI
  ]
})
export class ParametresPage implements OnInit {
  
  company: any = {
    name: '',
    address: '',
    contact_email: '',
    phone: '',
    logo_url: ''
  };
  
  isSaving = false;

  constructor(
    private api: ApiService,
    private toastCtrl: ToastController
  ) {
    addIcons({ saveOutline, cloudUploadOutline, businessOutline, callOutline, mailOutline });
  }

  ngOnInit() {
    this.loadCompany();
  }

  loadCompany() {
    this.api.getMyCompany().subscribe({
      next: (data) => this.company = data,
      error: () => console.log("Pas encore d'entreprise configurée")
    });
  }

  async uploadLogo() {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos
    });

    if (image.webPath) {
      const response = await fetch(image.webPath);
      const blob = await response.blob();
      
      this.api.uploadPhoto(blob).subscribe({
        next: (res) => {
          this.company.logo_url = res.url;
        },
        error: () => alert("Erreur upload logo")
      });
    }
  }

  save() {
    this.isSaving = true;
    this.api.updateMyCompany(this.company).subscribe({
      next: async () => {
        this.isSaving = false;
        const toast = await this.toastCtrl.create({
          message: 'Paramètres enregistrés ! Vos PDF sont à jour.',
          duration: 3000,
          color: 'success'
        });
        toast.present();
      },
      error: () => {
        this.isSaving = false;
        alert("Erreur sauvegarde");
      }
    });
  }
}