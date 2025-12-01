import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular'; // Import global pour simplifier
import { ActivatedRoute } from '@angular/router';
import { ApiService, Rapport } from '../../services/api';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { addIcons } from 'ionicons';
import { camera, time, warning, documentTextOutline } from 'ionicons/icons';
import { SignatureModalComponent } from './signature-modal/signature-modal.component';
import { ModalController } from '@ionic/angular';
import { createOutline } from 'ionicons/icons';
import { NewRapportModalComponent } from './new-rapport-modal/new-rapport-modal.component';
import { RapportDetailsModalComponent } from './rapport-details-modal/rapport-details-modal.component';

@Component({
  selector: 'app-chantier-details',
  templateUrl: './chantier-details.page.html',
  styleUrls: ['./chantier-details.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ChantierDetailsPage implements OnInit {
  chantierId: number = 0;
  rapports: Rapport[] = [];
  photoUrlTemp: string | undefined; // Pour afficher la photo juste prise avant envoi

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private modalCtrl: ModalController
  ) {
    addIcons({ camera, time, warning, documentTextOutline, createOutline });
  }

  ngOnInit() {
    // On récupère l'ID depuis l'URL (ex: /chantier/1)
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.chantierId = +id;
      this.loadRapports();
    }
  }

  loadRapports() {
    this.api.getRapports(this.chantierId).subscribe(data => {
      this.rapports = data.reverse(); // Les plus récents en haut
    });
  }

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
        // 1. On récupère le Blob
        const response = await fetch(image.webPath);
        const blob = await response.blob();

        // 2. 👇 CORRECTION ICI : On passe le blob ET le chemin webPath
        this.uploadAndCreateRapport(blob, image.webPath);
      }
    } catch (e) {
      console.log('Utilisateur a annulé ou erreur caméra', e);
    }
  }

  async openSignature() {
    const modal = await this.modalCtrl.create({
      component: SignatureModalComponent,
      componentProps: { chantierId: this.chantierId }
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm') {
      alert("Chantier signé avec succès !");
      // Tu pourrais ici afficher la signature sur la page si tu veux
    }
  }

  async uploadAndCreateRapport(blob: Blob, webPath: string) {
    // 1. Ouvrir la modale de saisie
    const modal = await this.modalCtrl.create({
      component: NewRapportModalComponent,
      // 👇 Attention : On utilise les nouveaux noms de props définis dans la modale
      componentProps: { 
        initialPhotoWebPath: webPath,
        initialPhotoBlob: blob 
      }
    });
    
    await modal.present();

    // 👇 CORRECTION ICI : On stocke le résultat dans une variable 'result'
    const result = await modal.onWillDismiss();

    if (result.role === 'confirm' && result.data) {
      // Maintenant 'result' existe, on peut lire dedans
      const { data, gps, blobs } = result.data; 
      
      const newRapport: Rapport = {
        titre: data.titre,
        description: data.description,
        chantier_id: this.chantierId,
        niveau_urgence: data.niveau_urgence,
        // On vérifie si le GPS est là
        latitude: gps ? gps.latitude : null,
        longitude: gps ? gps.longitude : null
      };

      // 3. On lance le tunnel Multi-Photos
      await this.api.addRapportWithMultiplePhotos(newRapport, blobs);
      
      // Petit délai pour laisser le temps au stockage local
      setTimeout(() => {
        this.loadRapports();
      }, 500);
    }
  }

  async openRapportDetails(rapport: Rapport) {
    const modal = await this.modalCtrl.create({
      component: RapportDetailsModalComponent,
      componentProps: { rapport: rapport }
    });
    modal.present();
  }

  // Helper pour afficher l'image complète (Backend URL + Localhost)
  getFullUrl(path: string | undefined) {
    if (!path) return '';
    
    // Si l'URL commence déjà par http (ex: image externe), on la garde
    if (path.startsWith('http')) return path;

    // Sinon, on colle l'URL de ton serveur Render
    // ATTENTION : Mets bien TON adresse Render à toi
    return 'https://conformeo-api.onrender.com' + path;
  }

  downloadPdf() {
    // Astuce simple : on ouvre l'URL du backend dans le navigateur du téléphone
    const url = `https://conformeo-api.onrender.com/chantiers/${this.chantierId}/pdf`;
    window.open(url, '_system');
  }
}