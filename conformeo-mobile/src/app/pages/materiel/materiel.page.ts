import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Platform } from '@ionic/angular/standalone'; 
import { 
  IonHeader, IonToolbar, IonContent,
  IonButtons, IonButton, IonIcon, IonFab, IonFabButton, 
  AlertController, IonBackButton, IonSearchbar,
  IonTitle, ModalController, LoadingController, IonBadge 
} from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import { addIcons } from 'ionicons';

import { 
  add, hammer, construct, home, swapHorizontal, qrCodeOutline,
  searchOutline, cube, homeOutline, locationOutline, shieldCheckmark,
  trashOutline, hammerOutline, cloudUploadOutline, createOutline 
} from 'ionicons/icons';

import { ApiService, Materiel, Chantier } from '../../services/api'; // Ensure correct path
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
    IonFabButton, IonBackButton, IonBadge
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
    private modalCtrl: ModalController,
    private loadingCtrl: LoadingController 
  ) {
    addIcons({
      add, hammer, construct, home, swapHorizontal, qrCodeOutline,
      searchOutline, cube, homeOutline, locationOutline, shieldCheckmark, createOutline,
      'trash-outline': trashOutline,
      'hammer-outline': hammerOutline,
      'cloud-upload-outline': cloudUploadOutline
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

  loadData(event?: any) {
    // 1. Load equipment
    this.api.getMateriels().subscribe(mats => {
      this.materiels = mats;
      this.filterMateriels(); // Apply filter if search is active
      if (event) event.target.complete();
    });

    // 2. Load sites (for badge names)
    this.api.getChantiers().subscribe(chantiers => {
      this.chantiers = chantiers;
    });
  }

  filterMateriels() {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredMateriels = this.materiels;
    } else {
      this.filteredMateriels = this.materiels.filter(m =>
        m.nom.toLowerCase().includes(term) ||
        (m.reference && m.reference.toLowerCase().includes(term)) // Safe check
      );
    }
  }

  // --- IMPORT CSV ---
  async onCSVSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const loading = await this.loadingCtrl.create({ message: 'Import en cours...' });
      await loading.present();

      this.api.importMaterielsCSV(file).subscribe({
        next: (res) => {
          loading.dismiss();
          alert(res.message);
          this.loadData(); // Refresh list
        },
        error: (err) => {
          loading.dismiss();
          console.error(err);
          alert("Erreur lors de l'import. Vérifiez le format du fichier.");
        }
      });
    }
  }

  // --- SCANNER ---
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
      const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
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
    if (mat) this.openTransfer(mat); // Open transfer directly
    else alert(`Aucun matériel trouvé avec la référence : ${code}`);
  }

  // --- SHOW QR CODE (PASSEPORT SECURITE) ---
  async showQrCode(mat: any) {
    const alert = await this.alertCtrl.create({
      header: mat.nom,
      subHeader: 'Passeport de Conformité',
      // Dynamically generated QR code via API for demo
      message: `<div style="text-align:center;">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=CONFORME-${mat.id}" style="margin: 10px auto; border-radius: 8px;">
                  <p>Statut: <strong>${mat.statut_vgp || 'INCONNU'}</strong></p>
                  <p style="font-size: 0.8em; color: gray;">Scannez pour voir le rapport VGP</p>
                </div>`,
      buttons: ['Fermer']
    });
    await alert.present();
  }

  // --- CREATION ---
  async addMateriel() {
    const modal = await this.modalCtrl.create({
      component: AddMaterielModalComponent
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') this.loadData();
  }

  // --- MODIFICATION ---
  async openEdit(mat: Materiel) {
    const modal = await this.modalCtrl.create({
      component: AddMaterielModalComponent,
      componentProps: { existingItem: mat } 
    });
    
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') this.loadData();
  }

  // --- TRANSFERT (DEPLACEMENT) ---
  async openTransfer(mat: Materiel) {
    const inputs: any[] = [
      { type: 'radio', label: '🏠 Retour au Dépôt', value: null, checked: !mat.chantier_id }
    ];
    this.chantiers.forEach(c => {
      inputs.push({
        type: 'radio', label: `🏗️ ${c.nom}`, value: c.id, checked: mat.chantier_id === c.id
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
            if (mat.chantier_id === chantierId && (chantierId !== null || mat.chantier_id !== null)) return;

            this.api.transferMateriel(mat.id!, chantierId).subscribe(() => {
              this.loadData();
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // --- SUPPRESSION ---
  async deleteMateriel(mat: Materiel) {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer ?',
      message: `Voulez-vous supprimer ${mat.nom} ?`,
      buttons: [
        { text: 'Non', role: 'cancel' },
        {
          text: 'Oui',
          handler: () => {
            this.api.deleteMateriel(mat.id!).subscribe(() => {
              this.loadData();
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // --- HELPERS VISUELS ---
  
  getImageUrl(mat: Materiel): string {
    if (mat.image_url && mat.image_url.trim() !== '') {
       if (mat.image_url.includes('cloudinary.com') && mat.image_url.includes('/upload/')) {
          return mat.image_url.replace('/upload/', '/upload/w_200,h_200,c_fill,q_auto,f_auto/');
       }
       return mat.image_url;
    }
    // Return empty string to let ngIf handle the fallback icon
    return ''; 
  }

  getThumbUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http:')) url = url.replace('http:', 'https:');
    
    if (url.includes('cloudinary.com') && url.includes('/upload/')) {
      if (url.includes('w_')) return url;
      return url.replace('/upload/', '/upload/w_250,h_250,c_fit,q_auto,f_auto/');
    }
    return url;
  }
  
  getChantierName(id: number | null | undefined): string {
    if (!id) return 'Au Dépôt';
    const c = this.chantiers.find(x => x.id === id);
    return c ? c.nom : 'Inconnu';
  }
  
  getStatusColor(etat: string | undefined): string {
    return etat || 'Bon';
  }

  getMaterielsSortis(): number {
    return this.materiels.filter(m => m.chantier_id).length;
  }

  getMaterielsDepot(): number {
    return this.materiels.filter(m => !m.chantier_id).length;
  }
}