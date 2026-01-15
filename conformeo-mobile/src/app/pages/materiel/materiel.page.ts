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
  trashOutline, hammerOutline, cloudUploadOutline, createOutline,
  printOutline // 👈 Ajout de l'icône d'impression
} from 'ionicons/icons';

import { ApiService, Materiel, Chantier } from '../../services/api'; 
import { AddMaterielModalComponent } from './add-materiel-modal/add-materiel-modal.component';
// 👇 Import de la nouvelle modale QR Code
import { QrCodeModalComponent } from './qr-code-modal/qr-code-modal.page';
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
      'cloud-upload-outline': cloudUploadOutline,
      'print-outline': printOutline // 👈 Enregistrement icône
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
      this.filterMateriels(); 
      if (event) event.target.complete();
    });

    // 2. Load sites
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
        (m.reference && m.reference.toLowerCase().includes(term)) ||
        (m.reference && m.reference.toLowerCase().includes(term)) // 👈 Correction : reference
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
          this.loadData();
        },
        error: (err) => {
          loading.dismiss();
          console.error(err);
          alert("Erreur lors de l'import. Vérifiez le format du fichier.");
        }
      });
    }
  }

  // --- SCANNER INTELLIGENT ---
  async startScan() {
    try {
      // 1. Permissions
      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera !== 'granted' && camera !== 'limited') {
        alert("Permission caméra refusée.");
        return;
      }

      // 2. Module Google (Android)
      if (Capacitor.getPlatform() === 'android') {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!available) await BarcodeScanner.installGoogleBarcodeScannerModule();
      }

      // 3. UI Hacks pour voir la caméra
      document.body.classList.add('barcode-scanner-active');
      const elements = document.querySelectorAll('body > *');
      elements.forEach((el: any) => {
        if (el.tagName !== 'APP-ROOT') el.style.display = 'none';
      });

      // 4. Scan
      const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });

      // 5. Restauration UI
      document.body.classList.remove('barcode-scanner-active');
      elements.forEach((el: any) => el.style.display = '');

      // 6. Traitement Résultat
      if (barcodes.length > 0) {
        const scannedData = barcodes[0].rawValue;
        console.log('Scanned:', scannedData);

        let foundMat = null;

        // Cas A : Format "CONFORME-ID"
        if (scannedData.startsWith('CONFORME-')) {
          const parts = scannedData.split('-');
          if(parts.length > 1) {
            const id = parseInt(parts[1].trim(), 10); // Trim + Base 10 pour éviter les erreurs
            foundMat = this.materiels.find(m => m.id === id);
          }
        } 
        // Cas B : Référence classique (Interne ou Externe)
        else {
          foundMat = this.materiels.find(m => 
            (m.reference && m.reference.trim() === scannedData.trim()) || 
            (m.reference && m.reference.trim() === scannedData.trim())
          );
        }

        if (foundMat) {
          this.openEdit(foundMat);
        } else {
          // Aide au débogage
          console.log('IDs dispos:', this.materiels.map(m => m.id));
          const alert = await this.alertCtrl.create({
            header: 'Introuvable',
            message: `Aucun matériel trouvé pour le code : "${scannedData}"`,
            buttons: ['Ok']
          });
          await alert.present();
        }
      }

    } catch (e: any) {
      console.error(e);
      document.body.classList.remove('barcode-scanner-active');
      document.querySelectorAll('body > *').forEach((el: any) => el.style.display = '');
      alert("Erreur Scanner : " + (e.message || JSON.stringify(e)));
    }
  }

  // --- SHOW QR CODE (VERSION MODALE) ---
  // Remplace l'ancienne version AlertController qui posait problème sur mobile
  async showQrCode(mat: any) {
    const modal = await this.modalCtrl.create({
      component: QrCodeModalComponent,
      componentProps: { mat: mat },
      breakpoints: [0, 0.8, 1], // Permet de slider vers le bas sur mobile
      initialBreakpoint: 0.8
    });
    await modal.present();
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
  
  getMaterielsSortis(): number {
    return this.materiels.filter(m => m.chantier_id).length;
  }

  getMaterielsDepot(): number {
    return this.materiels.filter(m => !m.chantier_id).length;
  }
}