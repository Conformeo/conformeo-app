import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router'; // <--- AJOUT
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonFab, IonFabButton, IonIcon, IonButton, 
  AlertController, NavController 
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
  imports: [CommonModule, FormsModule, IonContent, IonFab, IonFabButton, IonIcon, IonButton]
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
    if (!this.photoBlob) return;

    const newRapport: Rapport = {
      // On ajoute un TAG spécial pour le DOE
      titre: `♻️ DÉCHETS : ${this.scanResult.type}`, 
      description: `Volume estimé : ${this.scanResult.volume} m³. (Scan Auto)`,
      
      // 👇 C'EST ICI QU'ON CORRIGE : On utilise le vrai ID
      chantier_id: this.chantierId, 
      
      niveau_urgence: 'Faible' // C'est un constat, pas une alerte sécurité
    };

    this.api.addRapportWithMultiplePhotos(newRapport, [this.photoBlob]).then(() => {
      this.navCtrl.back();
    });
  }

  cancel() {
    this.navCtrl.back();
  }
}