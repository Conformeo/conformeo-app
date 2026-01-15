import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Platform } from '@ionic/angular/standalone'; 
import { 
  IonHeader, IonToolbar, IonContent,
  IonButtons, IonButton, IonIcon, IonFab, IonFabButton, 
  AlertController, IonBackButton, IonSearchbar,
  IonTitle, ModalController, LoadingController, IonBadge ,
  IonicSafeString
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
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=CONFORME-${mat.id}`;
    
    let color = '#7f8c8d'; // Gris
    let textStatus = 'INCONNU';

    if(mat.statut_vgp === 'CONFORME') { color = '#2dd36f'; textStatus = 'VGP OK'; }
    if(mat.statut_vgp === 'NON CONFORME') { color = '#eb445a'; textStatus = 'INTERDIT'; }
    if(mat.statut_vgp === 'A PREVOIR') { color = '#ffc409'; textStatus = 'A PRÉVOIR'; }

    // HTML pour l'affichage écran
    const htmlContent = `
      <div id="print-section" style="text-align: center;">
        <h3 style="margin:0; font-size: 1.2em;">${mat.nom}</h3>
        <p style="margin:5px 0; color:#666;">${mat.ref_interne || mat.reference || ''}</p>
        
        <img src="${qrUrl}" alt="QR Code" style="display: block; margin: 10px auto; width: 150px; height: 150px;">
        
        <div style="border: 2px solid ${color}; color: ${color}; padding: 5px 10px; border-radius: 5px; display:inline-block; font-weight:bold; margin-top:5px;">
          ${textStatus}
        </div>
        <p style="font-size: 0.8em; color: gray; margin-top:10px;">Prochaine VGP : ${mat.date_derniere_vgp ? new Date(new Date(mat.date_derniere_vgp).setFullYear(new Date(mat.date_derniere_vgp).getFullYear() + 1)).toLocaleDateString() : 'Non définie'}</p>
      </div>
    `;

    const alert = await this.alertCtrl.create({
      header: 'Passeport Sécurité',
      message: new IonicSafeString(htmlContent),
      buttons: [
        {
          text: 'Imprimer',
          cssClass: 'secondary',
          handler: () => {
            this.printLabel(mat, qrUrl, color, textStatus);
            return false; // Garde la fenêtre ouverte
          }
        },
        {
          text: 'Fermer',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  // 👇 NOUVELLE FONCTION D'IMPRESSION
  printLabel(mat: any, qrUrl: string, color: string, statusText: string) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert("Autorisez les pop-ups pour imprimer !");

    const vgpDate = mat.date_derniere_vgp ? new Date(mat.date_derniere_vgp) : new Date();
    const nextDate = new Date(vgpDate);
    nextDate.setFullYear(vgpDate.getFullYear() + 1);

    printWindow.document.write(`
      <html>
        <head>
          <title>Etiquette ${mat.nom}</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
            .label { border: 2px solid black; padding: 10px; width: 300px; margin: 0 auto; border-radius: 10px; }
            h1 { font-size: 18px; margin: 5px 0; }
            h2 { font-size: 14px; color: #555; margin-bottom: 10px; }
            img { width: 120px; height: 120px; }
            .status { font-weight: bold; font-size: 16px; margin-top: 10px; color: ${color}; border: 2px solid ${color}; display: inline-block; padding: 5px 10px; border-radius: 5px; }
            .dates { font-size: 10px; margin-top: 10px; color: #333; }
          </style>
        </head>
        <body onload="window.print();window.close()">
          <div class="label">
            <h1>${mat.nom}</h1>
            <h2>Ref: ${mat.ref_interne || mat.reference || '---'}</h2>
            <img src="${qrUrl}" />
            <br>
            <div class="status">${statusText}</div>
            <div class="dates">
              Validité jusqu'au : <strong>${nextDate.toLocaleDateString()}</strong>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
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