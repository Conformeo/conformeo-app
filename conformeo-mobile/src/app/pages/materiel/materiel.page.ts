import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Platform } from '@ionic/angular/standalone'; 
import { 
  IonHeader, IonToolbar, IonContent,
  IonButtons, IonButton, IonIcon, IonFab, IonFabButton, 
  AlertController, IonBackButton, IonSearchbar,
  IonTitle, ModalController // <--- ModalController est ici
} from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import { addIcons } from 'ionicons';
// 👇 AJOUT DE shieldCheckmark DANS LES IMPORTS
import { add, hammer, construct, home, swapHorizontal, qrCodeOutline, searchOutline, cube, homeOutline, locationOutline, shieldCheckmark } from 'ionicons/icons';
import { ApiService, Materiel, Chantier } from '../../services/api'; // Vérifiez le chemin (../..)
import { AddMaterielModalComponent } from './add-materiel-modal/add-materiel-modal.component';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

@Component({
  selector: 'app-materiel',
  templateUrl: './materiel.page.html',
  styleUrls: ['./materiel.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    IonHeader, 
    IonSearchbar,
    IonToolbar, 
    IonContent, 
    IonTitle,
    IonButtons, 
    IonButton, 
    IonIcon, 
    IonFab, 
    IonFabButton, 
    IonBackButton
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
    // 👇 AJOUT DE shieldCheckmark ICI
    addIcons({ add, hammer, construct, home, swapHorizontal, qrCodeOutline, searchOutline, cube, homeOutline, locationOutline, shieldCheckmark });
    
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
    this.api.getMateriels().subscribe(mats => {
      this.materiels = mats;
      this.filteredMateriels = mats;
      if (event) event.target.complete();
    });

    this.api.getChantiers().subscribe(chantiers => {
      this.chantiers = chantiers;
    });
  }

  filterMateriels() {
    const term = this.searchTerm.toLowerCase();
    this.filteredMateriels = this.materiels.filter(m => 
      m.nom.toLowerCase().includes(term) || m.reference.toLowerCase().includes(term)
    );
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
        if (!available) {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
        }
      }

      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode]
      });

      if (barcodes.length > 0) {
        const code = barcodes[0].rawValue;
        this.handleScanResult(code);
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

  // --- CREATION (MODALE) ---
  async addMateriel() {
    // 👇 C'EST ICI LE CHANGEMENT : ON OUVRE LA MODALE AU LIEU DE L'ALERTE
    const modal = await this.modalCtrl.create({
      component: AddMaterielModalComponent,
      // cssClass: 'auto-height' // Optionnel
    });
    
    await modal.present();
    
    // On attend que la modale se ferme
    const { role } = await modal.onWillDismiss();
    
    // Si l'utilisateur a créé (confirm), on recharge la liste
    if (role === 'confirm') {
      this.loadData();
    }
  }

  // --- DEPLACEMENT (INCHANGÉ) ---
  async moveMateriel(mat: Materiel) {
    const inputs: any[] = [
      { type: 'radio', label: '🏠 Retour au Dépôt', value: null, checked: mat.chantier_id === null }
    ];

    this.chantiers.forEach(c => {
      inputs.push({ type: 'radio', label: `🏗️ ${c.nom}`, value: c.id, checked: mat.chantier_id === c.id });
    });

    const alert = await this.alertCtrl.create({
      header: `Déplacer : ${mat.nom}`,
      inputs: inputs,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Valider Transfert',
          handler: (chantierId) => {
            this.api.transferMateriel(mat.id!, chantierId).subscribe(() => this.loadData());
          }
        }
      ]
    });
    await alert.present();
  }

  getChantierName(id: number | null | undefined): string {
    if (!id) return 'Au Dépôt';
    const c = this.chantiers.find(x => x.id === id);
    return c ? c.nom : 'Inconnu';
  }

  // --- STATS ---
  getMaterielsSortis(): number {
    return this.materiels.filter(m => m.chantier_id !== null).length;
  }

  getMaterielsDepot(): number {
    return this.materiels.filter(m => m.chantier_id === null).length;
  }
}