import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// 👇 AJOUTEZ L'IMPORT ROUTERLINK ICI
import { RouterLink } from '@angular/router'; 
import { 
  IonicModule, AlertController, ToastController, LoadingController, ModalController 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  business, documentText, cloudUpload, trash, shieldCheckmark, 
  briefcase, warning, calendar, eye, pencil, add, folderOpen, close, camera, 
  cloudUploadOutline, list, chevronForward // J'ajoute les icônes manquantes pour le bouton DUERP
} from 'ionicons/icons';
import { ApiService, Company, CompanyDoc } from '../../services/api';
import { SignatureModalComponent } from '../chantier-details/signature-modal/signature-modal.component';

@Component({
  selector: 'app-company',
  templateUrl: './company.page.html',
  styleUrls: ['./company.page.scss'],
  standalone: true,
  // 👇 AJOUTEZ RouterLink DANS CE TABLEAU 👇
  imports: [CommonModule, FormsModule, IonicModule, RouterLink]
})
export class CompanyPage implements OnInit {

  segment = 'docs';
  company: Company | null = null;
  docs: CompanyDoc[] = [];
  
  isLoading = false;
  hasExpiredDocs = false;

  isUploadModalOpen = false;
  newDoc = { titre: '', type_doc: 'AUTRE', date_expiration: '' };
  selectedFile: File | null = null;
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('logoInput') logoInput!: ElementRef;
  
  isLogoDragging = false; 

  constructor(
    private api: ApiService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private modalCtrl: ModalController
  ) {
    // 👇 Ajout des nouvelles icônes utilisées dans le HTML
    addIcons({ 
      business, documentText, cloudUpload, trash, shieldCheckmark, 
      briefcase, warning, calendar, eye, pencil, add, folderOpen, close, camera, 
      cloudUploadOutline, list, chevronForward 
    });
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    Promise.all([
      this.api.getMyCompany().toPromise(),
      this.api.getCompanyDocs().toPromise()
    ]).then(([comp, docs]) => {
      this.company = comp || null;
      this.docs = docs || [];
      this.checkGlobalStatus();
      this.isLoading = false;
    }).catch(err => {
      this.isLoading = false;
      console.error(err);
    });
  }

  // --- GESTION DU LOGO ---
  triggerLogoUpload() {
    this.logoInput.nativeElement.click();
  }

  onLogoDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isLogoDragging = true;
  }

  onLogoDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isLogoDragging = false;
  }

  onLogoDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isLogoDragging = false;
    
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        this.processLogoUpload(file);
      } else {
        this.presentToast('Veuillez glisser une image valide (JPG, PNG)', 'warning');
      }
    }
  }

  onLogoSelected(event: any) {
    const file = event.target.files[0];
    if (file) this.processLogoUpload(file);
  }

  async processLogoUpload(file: File) {
    if (!this.company) return;
    const load = await this.loadingCtrl.create({ message: 'Mise à jour du logo...' });
    await load.present();

    this.api.uploadPhoto(file).subscribe({
      next: (res) => {
        if (this.company) {
            this.company.logo_url = res.url;
            this.saveInfos(false);
        }
        load.dismiss();
        this.presentToast('Logo modifié ! 📸', 'success');
      },
      error: () => {
        load.dismiss();
        this.presentToast('Erreur upload logo', 'danger');
      }
    });
  }

  // --- GESTION DOCS ---
  checkGlobalStatus() {
    this.hasExpiredDocs = this.docs.some(d => {
        if(!d.date_expiration) return false;
        return new Date(d.date_expiration) < new Date();
    });
  }

  getExpirationStatus(dateStr?: string) {
    if (!dateStr) return { text: '', color: '' };
    const expDate = new Date(dateStr); 
    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return { text: `Expiré (${Math.abs(daysLeft)}j)`, color: 'danger' };
    if (daysLeft < 30) return { text: `Expire ds ${daysLeft}j`, color: 'warning' };
    return { text: `Valide`, color: 'success' };
  }

  getIcon(type: string) {
    switch(type) {
      case 'DUERP': return 'shield-checkmark';
      case 'ASSURANCE': return 'document-text';
      case 'KBIS': return 'business';
      default: return 'folder-open';
    }
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  async uploadDoc() {
    if (!this.selectedFile || !this.newDoc.titre) return;
    const load = await this.loadingCtrl.create({ message: 'Envoi...' });
    await load.present();

    let dateExp = undefined;
    if (this.newDoc.date_expiration) dateExp = this.newDoc.date_expiration.split('T')[0]; 

    this.api.uploadCompanyDoc(this.selectedFile, this.newDoc.titre, this.newDoc.type_doc, dateExp).subscribe({
      next: (newDoc) => {
        this.docs.push(newDoc);
        this.checkGlobalStatus();
        this.closeUploadModal();
        load.dismiss();
        this.presentToast('Document ajouté ! ✅', 'success');
      },
      error: () => {
        load.dismiss();
        this.presentToast('Erreur upload', 'danger');
      }
    });
  }

  closeUploadModal() {
    this.isUploadModalOpen = false;
    this.newDoc = { titre: '', type_doc: 'AUTRE', date_expiration: '' };
    this.selectedFile = null;
  }

  async signDocument(doc: any) {
    const alert = await this.alertCtrl.create({
      header: 'Signature',
      inputs: [ { name: 'nom', type: 'text', placeholder: 'Votre Nom' } ],
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Signer', handler: (data) => { if(data.nom) this.openSignaturePad(doc, data.nom); }}
      ]
    });
    await alert.present();
  }

  async openSignaturePad(doc: any, nom: string) {
    const modal = await this.modalCtrl.create({
      component: SignatureModalComponent,
      componentProps: { type: 'generic', chantierId: 0 }
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss(); 

    if (role === 'confirm' && data) {
        const load = await this.loadingCtrl.create({ message: 'Validation...' });
        await load.present();
        this.api.signCompanyDoc(doc.id, nom, data).subscribe({
            next: () => { load.dismiss(); this.presentToast('Signé ! ✍️', 'success'); },
            error: () => { load.dismiss(); this.presentToast('Erreur', 'danger'); }
        });
    }
  }

  openDoc(url: string) { window.open(url, '_system'); }

  async deleteDoc(doc: CompanyDoc) {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer ?',
      buttons: [
        { text: 'Non', role: 'cancel' },
        { text: 'Oui', role: 'destructive', handler: () => {
            this.api.deleteCompanyDoc(doc.id).subscribe(() => {
              this.docs = this.docs.filter(d => d.id !== doc.id);
              this.checkGlobalStatus();
            });
        }}
      ]
    });
    await alert.present();
  }

  async saveInfos(showToast = true) {
    if (!this.company) return;
    const load = await this.loadingCtrl.create({ message: 'Sauvegarde...' });
    await load.present();
    this.api.updateCompany(this.company).subscribe({
      next: () => { 
          load.dismiss(); 
          if(showToast) this.presentToast('Infos mises à jour ✅', 'success'); 
      },
      error: () => { load.dismiss(); this.presentToast('Erreur', 'danger'); }
    });
  }

  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 2000, color, position: 'bottom' });
    t.present();
  }
}