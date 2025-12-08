import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController, NavController } from '@ionic/angular'; // Groupé les imports Ionic
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, Rapport, Chantier, PPSPS } from 'src/app/services/api';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Platform } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { IonBackButton, IonButtons } from '@ionic/angular/standalone';
import { AddChantierModalComponent } from 'src/app/home/add-chantier-modal/add-chantier-modal.component';

// 👇 TOUTES LES ICONES (Y compris trashOutline qui manquait)
import { 
  camera, time, warning, documentText, create, navigate, 
  location, arrowBack, createOutline, trashOutline, // <--- AJOUT trashOutline
  scanOutline, checkmarkCircle, shieldCheckmark, downloadOutline,
  shieldCheckmarkOutline, map, checkmarkDoneCircle,
  checkmarkDoneCircleOutline, 
  documentTextOutline, archiveOutline, mapOutline
} from 'ionicons/icons';

import { PicModalComponent } from './pic-modal/pic-modal.component';
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
  
  chantier: Chantier | undefined; 
  rapports: Rapport[] = [];
  documentsList: any[] = [];
  ppspsList: PPSPS[] = []; // Ajout variable manquante si utilisée
  
  constructor(
    private route: ActivatedRoute,
    public api: ApiService,
    private modalCtrl: ModalController,
    private platform: Platform,
    private alertCtrl: AlertController,
    private navCtrl: NavController
  ) {
    // 👇 ENREGISTREMENT EXPLICITE (Mapping Nom -> Variable)
    addIcons({ 
      'camera': camera, 
      'time': time, 
      'warning': warning, 
      'document-text': documentText, 
      'create': create, 
      'navigate': navigate, 
      'location': location, 
      'arrow-back': arrowBack, 
      'document-text-outline': documentTextOutline, 
      'create-outline': createOutline, 
      'scan-outline': scanOutline, 
      'checkmark-circle': checkmarkCircle, 
      'shield-checkmark': shieldCheckmark, 
      'download-outline': downloadOutline, 
      'archive-outline': archiveOutline, 
      'shield-checkmark-outline': shieldCheckmarkOutline, 
      'map': map, 
      'map-outline': mapOutline,
      'trash-outline': trashOutline, // <--- AJOUT
      // C'est ici que ça bloquait pour l'audit :
      'checkmark-done-circle': checkmarkDoneCircle,
      'checkmark-done-circle-outline': checkmarkDoneCircleOutline
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.chantierId = +id;
      this.loadData();
    }
  }

  ionViewWillEnter() {
    if (this.api.needsRefresh) {
      console.log("🔄 Refresh demandé !");
      this.loadData();
      this.api.needsRefresh = false;
    }
  }

  loadData() {
    this.api.getChantierById(this.chantierId).subscribe(data => {
      this.chantier = data;
      this.buildDocumentsList(); 
    });
    this.loadRapports();
  }

  loadRapports() {
    this.api.getRapports(this.chantierId).subscribe(data => {
      this.rapports = data.reverse();
    });
  }

  // --- CONSTRUCTION LISTE DOCUMENTS ---
  buildDocumentsList() {
    this.documentsList = [];

    // A. Journal
    this.documentsList.push({
        type: 'RAPPORT',
        titre: 'Journal de Bord (Photos & QHSE)',
        date: new Date().toISOString(), 
        icon: 'document-text-outline',
        color: 'primary',
        action: () => this.downloadPdf()
    });

    // B. PPSPS
    this.api.getPPSPSList(this.chantierId).subscribe(docs => {
        this.ppspsList = docs;
        docs.forEach(doc => {
            this.documentsList.push({
                type: 'PPSPS',
                titre: 'PPSPS Officiel',
                date: doc.date_creation,
                icon: 'shield-checkmark-outline',
                color: 'warning',
                action: () => this.downloadPPSPS(doc.id!)
            });
        });
    });

    // C. PIC
    this.api.getPIC(this.chantierId).subscribe(pic => {
        if (pic && pic.final_url) {
            this.documentsList.push({
                type: 'PIC',
                titre: 'Plan Installation (PIC)',
                date: new Date().toISOString(),
                icon: 'map-outline',
                color: 'tertiary',
                action: () => window.open(this.getFullUrl(pic.final_url!), '_system')
            });
        }
    });

    // D. Audits QHSE 
    this.api.getInspections(this.chantierId).subscribe(audits => {
        audits.forEach(audit => {
            this.documentsList.push({
                type: 'AUDIT',
                titre: `Audit ${audit.type}`,
                date: audit.date_creation,
                icon: 'checkmark-done-circle-outline', // Icône explicitement mappée
                color: 'success',
                action: () => {
                    const url = `${this.api['apiUrl']}/inspections/${audit.id}/pdf`;
                    window.open(url, '_system');
                }
            });
        });
    });

    // E. Signature
    if (this.chantier && this.chantier.signature_url) {
        this.documentsList.push({
            type: 'SIGNATURE',
            titre: 'Signature Client',
            date: this.chantier.date_creation,
            icon: 'create-outline',
            color: 'medium',
            action: () => window.open(this.getFullUrl(this.chantier!.signature_url), '_system')
        });
    }
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
      console.log('Annulé', e);
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
      this.api.needsRefresh = true;
    }
  }

  openItinerary() {
    if (!this.chantier || !this.chantier.adresse) {
      alert("Adresse du chantier introuvable.");
      return;
    }

    const destination = encodeURIComponent(this.chantier.adresse);
    let url = '';

    if (this.platform.is('ios') || this.platform.is('ipad') || this.platform.is('iphone')) {
      // 📱 iOS : Ouvre Apple Maps
      url = `maps:?q=${destination}`;
    } else if (this.platform.is('android')) {
      // 📱 Android : Ouvre le choix (Waze, Maps...)
      url = `geo:0,0?q=${destination}`;
    } else {
      // 💻 Desktop / Web : Ouvre Google Maps dans un nouvel onglet
      // 👇 C'EST ICI LA CORRECTION
      url = `https://www.google.com/maps/search/?api=1&query=${destination}`;
    }

    window.open(url, '_system');
  }

  async editChantier() {
    const modal = await this.modalCtrl.create({
      component: AddChantierModalComponent,
      componentProps: { existingChantier: this.chantier }
    });
    
    await modal.present();
    const { role, data } = await modal.onWillDismiss();
    
    if (role === 'confirm' && data) {
      this.chantier = data; // Mise à jour immédiate de l'affichage
      this.api.needsRefresh = true; // Pour mettre à jour la liste d'accueil au retour
    }
  }
  
  downloadPdf() {
    const url = `${this.api['apiUrl']}/chantiers/${this.chantierId}/pdf`;
    window.open(url, '_system');
  }

  downloadPPSPS(docId: number) {
    const url = `${this.api['apiUrl']}/ppsps/${docId}/pdf`;
    window.open(url, '_system');
  }

  downloadDOE() {
    this.api.downloadDOE(this.chantierId);
  }

  async openPIC() {
    const modal = await this.modalCtrl.create({
      component: PicModalComponent,
      componentProps: { chantierId: this.chantierId }
    });
    
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (this.api.needsRefresh) {
       this.loadData();
       this.api.needsRefresh = false;
    }
  }

  async openSignature() {
    const modal = await this.modalCtrl.create({
      component: SignatureModalComponent,
      componentProps: { chantierId: this.chantierId }
    });
    
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (this.api.needsRefresh) {
        this.loadData();
        this.api.needsRefresh = false;
    }
  }

  async openRapportDetails(rapport: Rapport) {
    const modal = await this.modalCtrl.create({
      component: RapportDetailsModalComponent,
      componentProps: { rapport: rapport }
    });
    modal.present();
  }

  // --- SUPPRESSION CHANTIER ---
  async deleteChantier() {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer le chantier ?',
      message: 'Cette action est irréversible. Tous les rapports et documents seront effacés.',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: () => {
            this.api.deleteChantier(this.chantierId).subscribe(() => {
              this.navCtrl.navigateBack('/home');
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // --- HELPERS ---

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