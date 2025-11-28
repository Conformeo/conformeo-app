import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular'; // Import global pour simplifier
import { ActivatedRoute } from '@angular/router';
import { ApiService, Rapport } from '../../services/api';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { addIcons } from 'ionicons';
import { camera, time, warning, documentTextOutline } from 'ionicons/icons';

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
    private api: ApiService
  ) {
    addIcons({ camera, time, warning, documentTextOutline });
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

  uploadAndCreateRapport(blob: Blob) {
    // A. Upload de l'image
    this.api.uploadPhoto(blob).subscribe({
      next: (res) => {
        const serverUrl = res.url; // ex: /static/xxx.jpg
        
        // B. Création du rapport
        const newRapport: Rapport = {
          titre: 'Inspection Photo',
          description: 'Photo prise sur le terrain',
          chantier_id: this.chantierId,
          // photo_url sera passé en paramètre
        };

        this.api.createRapport(newRapport, serverUrl).subscribe(() => {
          this.loadRapports(); // Rafraîchir la liste
          this.photoUrlTemp = undefined; // Reset
        });
      },
      error: (err) => alert("Erreur upload")
    });
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