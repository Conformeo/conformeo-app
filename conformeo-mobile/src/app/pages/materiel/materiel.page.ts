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

import { ApiService, Materiel, Chantier } from '../../services/api'; // Correction du chemin
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
    // 1. Charger le matériel
    this.api.getMateriels().subscribe(mats => {
      this.materiels = mats;
      this.filterMateriels(); // On applique le filtre (si recherche en cours)
      if (event) event.target.complete();
    });

    // 2. Charger les chantiers (pour les noms dans les badges)
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
        m.reference.toLowerCase().includes(term)
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
          this.loadData(); // On rafraîchit la liste
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
    if (mat) this.openTransfer(mat); // On ouvre le transfert direct
    else alert(`Aucun matériel trouvé avec la référence : ${code}`);
  }

  // --- CRÉATION ---
  async addMateriel() {
    const modal = await this.modalCtrl.create({
      component: AddMaterielModalComponent
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') this.loadData();
  }

  // --- MODIFICATION ---
  async openEdit(mat: Materiel) { // Retiré 'event' car géré par le HTML si bien séparé
    const modal = await this.modalCtrl.create({
      component: AddMaterielModalComponent,
      componentProps: { existingItem: mat } 
    });
    
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') this.loadData();
  }

  // --- TRANSFERT (DEPLACEMENT) ---
  async openTransfer(mat: Materiel) { // Retiré 'event'
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
            // Si le chantier n'a pas changé, on ne fait rien
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
  async deleteMateriel(mat: Materiel) { // Retiré 'event'
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
  
  // Renvoie une URL d'image valide ou une placeholder
  getImageUrl(mat: Materiel): string {
    if (mat.image_url && mat.image_url.trim() !== '') {
       // Optimisation Cloudinary (Thumbnails pour la liste)
       if (mat.image_url.includes('cloudinary.com') && mat.image_url.includes('/upload/')) {
          return mat.image_url.replace('/upload/', '/upload/w_200,h_200,c_fill,q_auto,f_auto/');
       }
       return mat.image_url;
    }
    return 'assets/no-image.png'; // Image par défaut
  }

  // 👇 AJOUTEZ CETTE FONCTION MANQUANTE
  getThumbUrl(url: string): string {
    if (!url) return '';
    // Sécurise l'URL
    if (url.startsWith('http:')) url = url.replace('http:', 'https:');
    
    // Optimisation Cloudinary (Miniature)
    if (url.includes('cloudinary.com') && url.includes('/upload/')) {
      // Si l'URL a déjà été transformée par getImageUrl, on ne refait pas
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
    return etat || 'Bon'; // Retourne la classe CSS (Bon, Moyen, Mauvais...)
  }

  getMaterielsSortis(): number {
    return this.materiels.filter(m => m.chantier_id).length;
  }

  getMaterielsDepot(): number {
    return this.materiels.filter(m => !m.chantier_id).length;
  }

  
}