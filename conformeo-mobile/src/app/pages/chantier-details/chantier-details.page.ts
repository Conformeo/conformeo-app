import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators'; // <--- AJOUTER filter
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { ActivatedRoute, RouterLink } from '@angular/router'; // Ajout RouterLink
import { ApiService, Rapport, Chantier, PPSPS } from 'src/app/services/api'; // Import Chantier
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { addIcons } from 'ionicons';
import { 
  camera, time, warning, documentText, create, navigate, 
  location, arrowBack, createOutline ,
  scanOutline, checkmarkCircle, shieldCheckmark, downloadOutline,
  shieldCheckmarkOutline, // <--- AJOUTE ÇA (PPSPS)
  checkmarkDoneCircleOutline, // <--- AJOUTE ÇA (Audit)
  documentTextOutline // (Vérifie que tu as celui-là pour le PDF aussi)
} from 'ionicons/icons';

// Imports Standalone
import { IonBackButton, IonButtons } from '@ionic/angular/standalone';

// Import des modales
import { NewRapportModalComponent } from './new-rapport-modal/new-rapport-modal.component';
import { RapportDetailsModalComponent } from './rapport-details-modal/rapport-details-modal.component';
import { SignatureModalComponent } from './signature-modal/signature-modal.component';

@Component({
  selector: 'app-chantier-details',
  templateUrl: './chantier-details.page.html',
  styleUrls: ['./chantier-details.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, IonButtons, IonBackButton, RouterLink]
})
export class ChantierDetailsPage implements OnInit {
  chantierId: number = 0;
  
  // 👇 C'EST LA VARIABLE QUI MANQUAIT
  chantier: Chantier | undefined; 
  ppspsList: PPSPS[] = [];
  rapports: Rapport[] = [];
  photoUrlTemp: string | undefined;

  constructor(
    private route: ActivatedRoute,
    public api: ApiService, // Public pour accès HTML si besoin
    private modalCtrl: ModalController
  ) {
    addIcons({ camera, time, warning, documentText, create, navigate, location, arrowBack, documentTextOutline, createOutline, scanOutline, checkmarkCircle, shieldCheckmark, downloadOutline,
      shieldCheckmarkOutline, 
    checkmarkDoneCircleOutline
     });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.chantierId = +id;
      this.loadData(); // Premier chargement
    }
  }

  ionViewWillEnter() {
    // On vérifie si quelqu'un a demandé un refresh
    if (this.api.needsRefresh) {
      console.log("🚩 Drapeau détecté : Rechargement des données...");
      this.loadRapports();
      this.api.needsRefresh = false; // On baisse le drapeau
    }
  }

  loadData() {
    // 1. Chantier
    this.api.getChantierById(this.chantierId).subscribe(data => {
      this.chantier = data;
    });

    // 2. Rapports
    this.loadRapports();

    // 3. Documents PPSPS (NOUVEAU)
    this.api.getPPSPSList(this.chantierId).subscribe(docs => {
      this.ppspsList = docs;
    });
  }

  loadRapports() {
    this.api.getRapports(this.chantierId).subscribe(data => {
      this.rapports = data.reverse();
    });
  }

  // --- ACTIONS ---

  async takePhoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        correctOrientation: true
      });

      if (image.webPath) {
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        this.uploadAndCreateRapport(blob, image.webPath);
      }
    } catch (e) {
      console.log('Annulé/Erreur', e);
    }
  }

  async uploadAndCreateRapport(blob: Blob, webPath: string) {
    const modal = await this.modalCtrl.create({
      component: NewRapportModalComponent,
      componentProps: { initialPhotoWebPath: webPath, initialPhotoBlob: blob }
    });
    
    await modal.present();
    const result = await modal.onWillDismiss();

    if (result.role === 'confirm' && result.data) {
      const { data, gps, blobs } = result.data; 
      
      const newRapport: Rapport = {
        titre: data.titre,
        description: data.description,
        chantier_id: this.chantierId,
        niveau_urgence: data.niveau_urgence,
        latitude: gps ? gps.latitude : null,
        longitude: gps ? gps.longitude : null
      };

      await this.api.addRapportWithMultiplePhotos(newRapport, blobs);
      
      setTimeout(() => { this.loadRapports(); }, 500);
    }
  }

  openItinerary() {
    if (!this.chantier || !this.chantier.adresse) {
      alert("Adresse du chantier introuvable.");
      return;
    }

    // On encode l'adresse pour qu'elle soit propre dans l'URL (ex: les espaces deviennent %20)
    const destination = encodeURIComponent(this.chantier.adresse);

    // Astuce : Sur iOS, on ouvre Apple Maps, sur Android Google Maps
    // Mais le lien Google Maps Universel marche partout et redirige souvent vers l'app installée
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

    // On ouvre dans le navigateur système (qui va sûrement proposer d'ouvrir l'app Maps)
    window.open(url, '_system');
  }
  
  downloadPdf() {
    const url = `${this.api['apiUrl']}/chantiers/${this.chantierId}/pdf`;
    window.open(url, '_system');
  }

  downloadPPSPS(docId: number) {
    const url = `${this.api['apiUrl']}/ppsps/${docId}/pdf`;
    window.open(url, '_system');
  }

  async openSignature() {
    const modal = await this.modalCtrl.create({
      component: SignatureModalComponent,
      componentProps: { chantierId: this.chantierId }
    });
    await modal.present();
  }

  async openRapportDetails(rapport: Rapport) {
    const modal = await this.modalCtrl.create({
      component: RapportDetailsModalComponent,
      componentProps: { rapport: rapport }
    });
    modal.present();
  }

  // --- HELPERS VISUELS ---

  getFullUrl(path: string | undefined) {
    if (!path) return '';
    if (path.startsWith('http') && path.includes('cloudinary.com')) {
      return path.replace('/upload/', '/upload/w_500,f_auto,q_auto/');
    }
    return 'https://conformeo-api.onrender.com' + path;
  }

  hasImage(rap: Rapport): boolean {
    return (rap.images && rap.images.length > 0) || !!rap.photo_url;
  }

  getFirstImage(rap: Rapport): string {
    if (rap.images && rap.images.length > 0) {
      return this.getFullUrl(rap.images[0].url);
    }
    return this.getFullUrl(rap.photo_url);
  }
}