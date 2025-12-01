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
      // 1. Ouvrir la caméra
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        correctOrientation: true
      });

      if (image.webPath) {
        this.photoUrlTemp = image.webPath; // Affichage temporaire
        
        // 2. Convertir en Blob pour l'envoi
        const response = await fetch(image.webPath);
        const blob = await response.blob();

        // 3. Envoyer au serveur
        this.uploadAndCreateRapport(blob);
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

  async uploadAndCreateRapport(blob: Blob) {
    // 1. On prépare les infos du rapport
    const newRapport: Rapport = {
      titre: 'Inspection Photo',
      description: 'Photo prise sur le terrain',
      chantier_id: this.chantierId,
    };

    try {
      // 2. 👇 C'EST ICI LA CLÉ : On utilise la nouvelle fonction du service
      // Elle gère le mode avion toute seule (sauvegarde locale)
      const success = await this.api.addRapportWithPhoto(newRapport, blob);

      if (success) {
        // 3. Feedback utilisateur
        // Si on est hors ligne, on prévient que c'est en attente
        if (!this.api['offline'].isOnline.value) { // (Accès rapide pour vérifier)
             alert("Photo sauvegardée dans le téléphone (En attente de réseau 📡)");
        } else {
             // Si en ligne, c'est direct
             // (Optionnel : petit toast de succès)
        }
        
        this.loadRapports();
        this.photoUrlTemp = undefined; 
      }

    } catch (e) {
      console.error("Erreur processus photo", e);
      alert("Erreur lors de l'enregistrement.");
    }
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