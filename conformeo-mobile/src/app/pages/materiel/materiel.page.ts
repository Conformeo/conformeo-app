import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Platform } from '@ionic/angular/standalone'; 
import { 
  IonHeader, IonToolbar, IonContent,
  IonButtons, IonButton, IonIcon, IonFab, IonFabButton, 
  AlertController, IonBackButton, IonSearchbar,
  IonTitle, ModalController
} from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import { addIcons } from 'ionicons';
import { 
  add, hammer, construct, home, swapHorizontal, qrCodeOutline,
  searchOutline, cube, homeOutline, locationOutline, shieldCheckmark
} from 'ionicons/icons';

import { ApiService, Materiel, Chantier } from '../../services/api';
import { AddMaterielModalComponent } from './add-materiel-modal/add-materiel-modal.component';

import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

@Component({
  selector: 'app-materiel',
  templateUrl: './materiel.page.html',
  styleUrls: ['./materiel.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonHeader, IonSearchbar,
    IonToolbar, IonContent, IonTitle,
    IonButtons, IonButton, IonIcon, IonFab,
    IonFabButton, IonBackButton
  ]
})
export class MaterielPage implements OnInit {

  materiels: Materiel[] = [];
  filteredMateriels: Materiel[] = [];
  chantiers: Chantier[] = [];
  searchTerm: string = '';

  isDesktop = false;

  constructor(
    private api: ApiService,
    private alertCtrl: AlertController,
    private platform: Platform,
    private modalCtrl: ModalController
  ) {
    addIcons({
      add, hammer, construct, home, swapHorizontal, qrCodeOutline,
      searchOutline, cube, homeOutline, locationOutline, shieldCheckmark
    });

    this.checkScreen();
    this.platform.resize.subscribe(() => this.checkScreen());
  }

  ngOnInit() {
    this.loadData();
  }

  checkScreen() {
    this.isDesktop = window.innerWidth >= 992;
  }

  // -----------------------------------------------------
  // 🔄 CHARGEMENT DES DONNÉES
  // -----------------------------------------------------
  loadData(event?: any) {
    this.api.getMateriels().subscribe(mats => {
      this.materiels = mats;
      this.filteredMateriels = mats;
      if (event) event.target.complete();
    });

    this.api.getChantiers().subscribe(chantiers => {
      this.chantiers = chantiers;
    });
  }

  // -----------------------------------------------------
  // 🔍 FILTRE
  // -----------------------------------------------------
  filterMateriels() {
    const term = this.searchTerm.toLowerCase().trim();
    this.filteredMateriels = this.materiels.filter(m =>
      m.nom.toLowerCase().includes(term) ||
      m.reference.toLowerCase().includes(term)
    );
  }

  // -----------------------------------------------------
  // 📸 SCANNER
  // -----------------------------------------------------
  async startScan() {
    try {
      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera !== 'granted' && camera !== 'limited') {
        alert("Permission caméra refusée.");
        return;
      }

      if (Capacitor.getPlatform() === 'android') {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!available) await BarcodeScanner.installGoogleBarcodeScannerModule();
      }

      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode]
      });

      if (barcodes.length > 0) {
        this.handleScanResult(barcodes[0].rawValue);
      }

    } catch (e: any) {
      console.error(e);
      alert("Erreur Scanner : " + (e.message || JSON.stringify(e)));
    }
  }

  handleScanResult(code: string) {
    const mat = this.materiels.find(m => m.reference === code);

    if (mat) {
      this.moveMateriel(mat);
    } else {
      alert(`Aucun matériel trouvé avec la référence : ${code}`);
    }
  }

  // -----------------------------------------------------
  // ➕ AJOUT VIA MODALE
  // -----------------------------------------------------
  async addMateriel() {
    const modal = await this.modalCtrl.create({
      component: AddMaterielModalComponent
    });
    
    await modal.present();

    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') {
      this.loadData();
    }
  }

  // -----------------------------------------------------
  // 🔁 DEPLACEMENT
  // -----------------------------------------------------
  async moveMateriel(mat: Materiel) {

    const inputs: any[] = [
      { type: 'radio', label: '🏠 Retour au Dépôt', value: null, checked: !mat.chantier_id }
    ];

    this.chantiers.forEach(c => {
      inputs.push({
        type: 'radio',
        label: `🏗️ ${c.nom}`,
        value: c.id,
        checked: mat.chantier_id === c.id
      });
    });

    const alert = await this.alertCtrl.create({
      header: `Déplacer : ${mat.nom}`,
      inputs,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Valider Transfert',
          handler: chantierId => {
            this.api.transferMateriel(mat.id!, chantierId).subscribe(() => {
              this.loadData();
            });
          }
        }
      ]
    });

    await alert.present();
  }

  // -----------------------------------------------------
  // 🖼️ IMAGE CLOUDINARY → MINIATURE
  // -----------------------------------------------------

  /** Retourne la vraie URL de l'image, ou '' si rien */
  getImageUrl(mat: Materiel): string {
    if (!mat.image_url || mat.image_url.trim() === '') {
      return '';
    }
    return mat.image_url;
  }

  /** Génère une miniature Cloudinary propre */
  getThumbUrl(url: string | undefined): string {
    if (!url) return '';

    if (url.includes('cloudinary.com') && url.includes('/upload/')) {
      return url.replace(
        '/upload/',
        '/upload/w_250,h_250,c_fit,q_auto,f_auto/'
      );
    }

    return url;
  }

  // -----------------------------------------------------
  // 🏷️ NOMS & STATISTIQUES
  // -----------------------------------------------------
  getChantierName(id: number | null | undefined): string {
    if (!id) return 'Au Dépôt';
    const c = this.chantiers.find(x => x.id === id);
    return c ? c.nom : 'Inconnu';
  }

  getMaterielsSortis(): number {
    return this.materiels.filter(m => m.chantier_id).length;
  }

  getMaterielsDepot(): number {
    return this.materiels.filter(m => !m.chantier_id).length;
  }

  async deleteMateriel(event: Event, mat: Materiel) {
    event.stopPropagation(); // Empêche d'ouvrir le menu "Déplacer"
    
    const alert = await this.alertCtrl.create({
      header: 'Supprimer ?',
      message: `Voulez-vous supprimer ${mat.nom} ?`,
      buttons: [
        { text: 'Non', role: 'cancel' },
        {
          text: 'Oui',
          handler: () => {
            this.api.deleteMateriel(mat.id!).subscribe(() => {
              this.loadData(); // Rafraîchir la liste
            });
          }
        }
      ]
    });
    await alert.present();
  }
}
