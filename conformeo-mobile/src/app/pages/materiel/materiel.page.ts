import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Platform } from '@ionic/angular/standalone'; 
import { 
  IonHeader, IonToolbar, IonContent,
  IonButtons, IonButton, IonIcon, IonFab, IonFabButton, 
  AlertController, IonBackButton, IonSearchbar,
  IonTitle, ModalController, LoadingController, IonBadge, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import { addIcons } from 'ionicons';

import { 
  add, hammer, construct, home, swapHorizontal, qrCodeOutline,
  searchOutline, cube, homeOutline, locationOutline, shieldCheckmark,
  trashOutline, hammerOutline, cloudUploadOutline, createOutline,
  printOutline 
} from 'ionicons/icons';

import { ApiService, Materiel, Chantier } from '../../services/api'; 
import { AddMaterielModalComponent } from './add-materiel-modal/add-materiel-modal.component';
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
    IonFabButton, IonBackButton, IonBadge,
    IonRefresher, IonRefresherContent // ✅ Ajout des imports pour le Pull-to-refresh
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
      'print-outline': printOutline
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
    // 1. Chargement Chantiers
    this.api.getChantiers().subscribe(chantiers => {
      this.chantiers = chantiers;
    });

    // 2. Chargement Matériel
    this.api.getMateriels().subscribe({
      next: (mats) => {
        this.materiels = mats;
        this.filterMateriels(); 
        if (event) event.target.complete();
      },
      error: (err) => {
        console.error(err);
        if (event) event.target.complete(); // ✅ Important : stop le chargement même en cas d'erreur
      }
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
        // 👇 CORRECTION : J'ai remplacé la ligne dupliquée par ref_interne
        // Assurez-vous que ref_interne existe dans votre interface Materiel
        (m.ref_interne && m.ref_interne.toLowerCase().includes(term)) 
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
          this.presentAlert('Succès', res.message || 'Import réussi');
          this.loadData();
        },
        error: (err) => {
          loading.dismiss();
          console.error(err);
          this.presentAlert('Erreur', "Erreur lors de l'import. Vérifiez le format du fichier.");
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
        this.presentAlert('Erreur', "Permission caméra refusée.");
        return;
      }

      // 2. Module Google (Android)
      if (Capacitor.getPlatform() === 'android') {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!available) await BarcodeScanner.installGoogleBarcodeScannerModule();
      }

      // 3. UI Hacks (Masquer le contenu pour voir la caméra derrière la WebView)
      document.body.classList.add('barcode-scanner-active');
      const elements = document.querySelectorAll('body > *');
      elements.forEach((el: any) => {
        // On ne masque pas le composant racine app-root totalement sinon l'app disparaît
        if (el.tagName !== 'APP-ROOT') el.style.display = 'none';
      });

      // 4. Scan
      const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });

      // 5. Restauration UI (IMPORTANT : Toujours restaurer)
      document.body.classList.remove('barcode-scanner-active');
      elements.forEach((el: any) => el.style.display = '');

      // 6. Traitement Résultat
      if (barcodes.length > 0) {
        const scannedData = barcodes[0].rawValue;
        console.log('Scanned:', scannedData);

        let foundMat = null;

        // Cas A : Format "CONFORME-ID" (ex: CONFORME-52)
        if (scannedData.startsWith('CONFORME-')) {
          const parts = scannedData.split('-');
          if(parts.length > 1) {
            const id = parseInt(parts[1].trim(), 10);
            foundMat = this.materiels.find(m => m.id === id);
          }
        } 
        // Cas B : Référence classique (Interne ou Externe)
        else {
          const searchRef = scannedData.trim().toLowerCase();
          foundMat = this.materiels.find(m => 
            (m.reference && m.reference.trim().toLowerCase() === searchRef) || 
            // 👇 CORRECTION : Recherche aussi sur ref_interne
            (m.ref_interne && m.ref_interne.trim().toLowerCase() === searchRef)
          );
        }

        if (foundMat) {
          this.openEdit(foundMat);
        } else {
          this.presentAlert('Introuvable', `Aucun matériel trouvé pour le code : "${scannedData}"`);
        }
      }

    } catch (e: any) {
      console.error(e);
      // Sécurité : On s'assure que l'UI est restaurée même en cas d'erreur
      document.body.classList.remove('barcode-scanner-active');
      document.querySelectorAll('body > *').forEach((el: any) => el.style.display = '');
      
      // On ignore l'erreur si l'utilisateur annule le scan
      if (!e.message?.includes('canceled')) {
         this.presentAlert('Erreur Scanner', e.message || JSON.stringify(e));
      }
    }
  }

  // --- SHOW QR CODE ---
  async showQrCode(mat: any) {
    const modal = await this.modalCtrl.create({
      component: QrCodeModalComponent,
      componentProps: { mat: mat },
      breakpoints: [0, 0.85], // Un peu plus haut pour être confortable
      initialBreakpoint: 0.85
    });
    await modal.present();
  }

  // --- ACTIONS CRUD ---
  
  async addMateriel() {
    const modal = await this.modalCtrl.create({
      component: AddMaterielModalComponent
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') this.loadData();
  }

  async openEdit(mat: Materiel) {
    const modal = await this.modalCtrl.create({
      component: AddMaterielModalComponent,
      componentProps: { existingItem: mat } 
    });
    
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') this.loadData();
  }

  async openTransfer(mat: Materiel) {
    const inputs: any[] = [
      { type: 'radio', label: '🏠 Retour au Dépôt', value: null, checked: !mat.chantier_id }
    ];
    
    // Trier les chantiers par nom pour faciliter la recherche visuelle
    this.chantiers.sort((a,b) => a.nom.localeCompare(b.nom)).forEach(c => {
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
          text: 'Valider',
          handler: (chantierId) => {
            // Pas de changement ? On ne fait rien.
            if (mat.chantier_id === chantierId) return;

            this.api.transferMateriel(mat.id!, chantierId).subscribe(() => {
              this.loadData();
            });
          }
        }
      ]
    });
    await alert.present();
  }

  async deleteMateriel(mat: Materiel) {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer ?',
      message: `Voulez-vous vraiment supprimer ${mat.nom} ?`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer',
          role: 'destructive', // Affiche le bouton en rouge sur iOS
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

  // --- HELPERS ---

  async presentAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  // Optimisation de l'affichage image (plus robuste)
  getImageUrl(mat: Materiel): string {
    if (!mat.image_url || mat.image_url.trim() === '') return '';
    
    // Optimisation Cloudinary si utilisé
    if (mat.image_url.includes('cloudinary.com') && mat.image_url.includes('/upload/')) {
       // Si l'URL contient déjà des transformations, on ne touche pas, sinon on ajoute
       if (!mat.image_url.includes('/w_')) {
          return mat.image_url.replace('/upload/', '/upload/w_200,h_200,c_fill,q_auto,f_auto/');
       }
    }
    return mat.image_url;
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