import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router'; // <--- AJOUT
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonFab, IonFabButton, IonIcon, IonButton, 
  AlertController, NavController, IonSpinner
} from '@ionic/angular/standalone';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { addIcons } from 'ionicons';
import { camera, checkmark, close } from 'ionicons/icons';
import { ApiService, Rapport } from 'src/app/services/api';

@Component({
  selector: 'app-smart-scan',
  templateUrl: './smart-scan.page.html',
  styleUrls: ['./smart-scan.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonFab, IonFabButton, IonIcon, IonButton, IonSpinner]
})
export class SmartScanPage {
  
  photoPath: string | undefined;
  photoBlob: Blob | undefined;
  chantierId: number = 0;
  
  // Les données "analysées" (saisies par l'utilisateur pour l'instant)
  scanResult = {
    type: '',
    volume: ''
  };

  isSaving: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private alertCtrl: AlertController,
    private api: ApiService,
    private navCtrl: NavController
  ) {
    addIcons({ camera, checkmark, close });
  }

  ngOnInit() {
    // On récupère l'ID passé dans l'URL
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.chantierId = +id;
    }
  }

  // Lancer le scan
  async startSmartScan() {
    const image = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      correctOrientation: true
    });

    if (image.webPath) {
      this.photoPath = image.webPath;
      const response = await fetch(image.webPath);
      this.photoBlob = await response.blob();
      
      // Simulation de "l'IA" : on demande à l'humain
      this.askDetails();
    }
  }

  async askDetails() {
    const alert = await this.alertCtrl.create({
      header: 'Analyse Déchets',
      inputs: [
        { name: 'type', type: 'text', placeholder: 'Type (ex: Gravats, Bois...)' },
        { name: 'volume', type: 'number', placeholder: 'Volume estimé (m3)' }
      ],
      buttons: [
        { text: 'Annuler', role: 'cancel', handler: () => this.photoPath = undefined },
        { 
          text: 'Valider', 
          handler: (data) => {
            this.scanResult.type = data.type || 'Non identifié';
            this.scanResult.volume = data.volume || '0';
          }
        }
      ]
    });
    await alert.present();
  }

  saveScan() {
    // 1. Sécurités
    if (!this.photoBlob) return;
    if (this.isSaving) return; // Si déjà en train de sauvegarder, on bloque !

    // 2. On verrouille
    this.isSaving = true;

    const newRapport: Rapport = {
      titre: `♻️ DÉCHETS : ${this.scanResult.type}`,
      description: `Volume estimé : ${this.scanResult.volume} m³. (Scan Auto)`,
      chantier_id: this.chantierId,
      niveau_urgence: 'Faible'
    };

    // 3. On envoie
    this.api.addRapportWithMultiplePhotos(newRapport, [this.photoBlob]).then(() => {
      
      // 👇 ON LEVE LE DRAPEAU ICI
      this.api.needsRefresh = true;
      
      this.navCtrl.back();
    }).catch(() => {
      this.isSaving = false;
      alert("Erreur lors de la sauvegarde");
    });
  }

  cancel() {
    this.navCtrl.back();
  }
}