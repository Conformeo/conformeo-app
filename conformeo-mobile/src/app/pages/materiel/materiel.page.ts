import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Platform } from '@ionic/angular/standalone'; 
import { 
  IonHeader, IonToolbar, IonContent,
  IonButtons, IonButton, IonIcon, IonFab, IonFabButton, 
  AlertController, IonBackButton, IonSearchbar,
  IonTitle,
} from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import { addIcons } from 'ionicons';
import { add, hammer, construct, home, swapHorizontal, qrCodeOutline, searchOutline, cube, homeOutline, locationOutline } from 'ionicons/icons';
import { ApiService, Materiel, Chantier } from '../../services/api';

// 👇 NOUVEAUX IMPORTS POUR ML KIT
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

@Component({
  selector: 'app-materiel',
  templateUrl: './materiel.page.html',
  styleUrls: ['./materiel.page.scss'],
  standalone: true,
  imports: [CommonModule, 
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
    IonBackButton]
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
    private platform: Platform 
  ) {
    addIcons({ add, hammer, construct, home, swapHorizontal, qrCodeOutline, searchOutline, cube, homeOutline, locationOutline });
    // Détection de la taille d'écran au démarrage
    this.checkScreen();
    // Écoute du redimensionnement
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

  // --- LE NOUVEAU SCANNER (Beaucoup plus court !) ---
  async startScan() {
    try {
      // 1. Demander la permission
      const { camera } = await BarcodeScanner.requestPermissions();
      
      if (camera !== 'granted' && camera !== 'limited') {
        alert("Permission caméra refusée.");
        return;
      }

      // 2. (Android Uniquement) Vérifier le module Google
      // 👇 C'EST ICI LA CORRECTION 👇
      if (Capacitor.getPlatform() === 'android') {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!available) {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
        }
      }

      // 3. Lancer le scan (Fonctionne sur iOS et Android)
      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode]
      });

      // 4. Résultat
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

  // --- Création (inchangé) ---
  async addMateriel() {
    const alert = await this.alertCtrl.create({
      header: 'Nouvel Outil',
      inputs: [
        { name: 'nom', type: 'text', placeholder: 'Nom (ex: Perceuse)' },
        { name: 'ref', type: 'text', placeholder: 'Référence (ex: HIL-01)' }
      ],
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Créer',
          handler: (data) => {
            if (data.nom) {
              this.api.createMateriel({ nom: data.nom, reference: data.ref, etat: 'Bon' }).subscribe(() => {
                this.loadData();
              });
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // --- Déplacement (inchangé) ---
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

  // --- Helpers pour les stats ---
  getMaterielsSortis(): number {
    return this.materiels.filter(m => m.chantier_id !== null).length;
  }

  getMaterielsDepot(): number {
    return this.materiels.filter(m => m.chantier_id === null).length;
  }
}