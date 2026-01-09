import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonicModule, AlertController, ToastController, LoadingController, ModalController 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  business, documentText, cloudUpload, trash, shieldCheckmark, 
  briefcase, warning, calendar, eye, pencil, add, folderOpen, close
} from 'ionicons/icons';
import { ApiService, Company, CompanyDoc } from '../../services/api';
import { SignatureModalComponent } from '../chantier-details/signature-modal/signature-modal.component';

@Component({
  selector: 'app-company',
  templateUrl: './company.page.html',
  styleUrls: ['./company.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class CompanyPage implements OnInit {

  segment = 'docs'; // On commence par l'onglet Documents par défaut
  company: Company | null = null;
  docs: CompanyDoc[] = [];
  
  isLoading = false;
  hasExpiredDocs = false;

  // Variables pour l'upload
  isUploadModalOpen = false;
  newDoc = { titre: '', type_doc: 'AUTRE', date_expiration: '' };
  selectedFile: File | null = null;
  @ViewChild('fileInput') fileInput!: ElementRef;

  constructor(
    private api: ApiService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private modalCtrl: ModalController
  ) {
    addIcons({ 
      business, documentText, cloudUpload, trash, shieldCheckmark, 
      briefcase, warning, calendar, eye, pencil, add, folderOpen, close 
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

  // --- LOGIQUE METIER DOCUMENTS ---

  checkGlobalStatus() {
    // Vérifie s'il y a des documents périmés
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

    if (daysLeft < 0) return { text: `Expiré depuis ${Math.abs(daysLeft)}j`, color: 'danger' };
    if (daysLeft < 30) return { text: `Expire dans ${daysLeft}j`, color: 'warning' };
    
    return { text: `Valide (${expDate.toLocaleDateString('fr-FR')})`, color: 'success' };
  }

  getIcon(type: string) {
    switch(type) {
      case 'DUERP': return 'shield-checkmark';
      case 'ASSURANCE': return 'document-text';
      case 'KBIS': return 'business';
      default: return 'folder-open';
    }
  }

  // --- UPLOAD ---

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  async uploadDoc() {
    if (!this.selectedFile || !this.newDoc.titre) return;

    const load = await this.loadingCtrl.create({ message: 'Envoi...' });
    await load.present();

    let dateExp = undefined;
    if (this.newDoc.date_expiration) {
      dateExp = this.newDoc.date_expiration.split('T')[0]; 
    }

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

  // --- SIGNATURE (Feature Clé) ---

  async signDocument(doc: any) {
    // 1. On demande qui signe
    const alert = await this.alertCtrl.create({
      header: 'Signature Document',
      message: `Vous allez signer la prise de connaissance de : ${doc.titre}`,
      inputs: [ { name: 'nom', type: 'text', placeholder: 'Votre Nom' } ],
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Continuer', handler: (data) => {
            if(data.nom) this.openSignaturePad(doc, data.nom);
        }}
      ]
    });
    await alert.present();
  }

  async openSignaturePad(doc: any, nom: string) {
    const modal = await this.modalCtrl.create({
      component: SignatureModalComponent,
      componentProps: { 
        type: 'generic', // Indique qu'on ne sauvegarde pas dans "chantier"
        chantierId: 0 
      }
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss(); 

    if (role === 'confirm' && data) {
        // data = URL de la signature sur Cloudinary
        const load = await this.loadingCtrl.create({ message: 'Validation...' });
        await load.present();

        // Appel API pour sauvegarder la signature sur ce document
        this.api.signCompanyDoc(doc.id, nom, data).subscribe({
            next: () => {
                load.dismiss();
                this.presentToast('Document signé et validé ! ✍️', 'success');
                // Optionnel : Recharger pour voir l'état signé si vous l'affichez
            },
            error: () => {
                load.dismiss();
                this.presentToast('Erreur lors de la signature', 'danger');
            }
        });
    }
  }

  // --- AUTRES ACTIONS ---

  openDoc(url: string) {
    window.open(url, '_system');
  }

  async deleteDoc(doc: CompanyDoc) {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer ?',
      message: 'Action irréversible.',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Supprimer', role: 'destructive', handler: () => {
            this.api.deleteCompanyDoc(doc.id).subscribe(() => {
              this.docs = this.docs.filter(d => d.id !== doc.id);
              this.checkGlobalStatus();
            });
        }}
      ]
    });
    await alert.present();
  }

  // --- SAUVEGARDE INFOS ---
  async saveInfos() {
    if (!this.company) return;
    const load = await this.loadingCtrl.create({ message: 'Sauvegarde...' });
    await load.present();
    this.api.updateCompany(this.company).subscribe({
      next: () => { load.dismiss(); this.presentToast('Infos mises à jour ✅', 'success'); },
      error: () => { load.dismiss(); this.presentToast('Erreur', 'danger'); }
    });
  }

  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 2000, color, position: 'bottom' });
    t.present();
  }
}