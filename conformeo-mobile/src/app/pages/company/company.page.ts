import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router'; 
import { 
  IonicModule, AlertController, ToastController, LoadingController, ModalController 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  business, documentText, cloudUpload, trash, shieldCheckmark, 
  briefcase, warning, calendar, eye, pencil, add, folderOpen, close, camera, 
  cloudUploadOutline, list, chevronForward, image, logOutOutline
} from 'ionicons/icons';
import { ApiService, CompanyDoc } from '../../services/api';
import { SignatureModalComponent } from '../chantier-details/signature-modal/signature-modal.component';

@Component({
  selector: 'app-company',
  templateUrl: './company.page.html',
  styleUrls: ['./company.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterLink]
})
export class CompanyPage implements OnInit {

  segment = 'infos'; // ou 'docs' par défaut selon préférence
  company: any = null;
  docs: any[] = [];
  
  isLoading = false;
  hasExpiredDocs = false;

  isUploadModalOpen = false;
  newDoc = { titre: '', type_doc: 'AUTRE', date_expiration: '' };
  selectedFile: File | null = null;
  
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('logoInput') logoInput!: ElementRef;
  isLogoDragging = false; 

  constructor(
    public api: ApiService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private modalCtrl: ModalController
  ) {
    addIcons({ 
      business, documentText, cloudUpload, trash, shieldCheckmark, 
      briefcase, warning, calendar, eye, pencil, add, folderOpen, close, camera, 
      cloudUploadOutline, list, chevronForward, image, logOutOutline
    });
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    
    // On charge l'utilisateur, l'entreprise et les docs
    Promise.all([
      this.api.getMe().toPromise(),
      this.api.getMyCompany().toPromise().catch(() => null), // Catch si pas d'entreprise (404)
      this.api.getCompanyDocs().toPromise().catch(() => [])
    ]).then(([user, comp, docs]) => {
      
      this.company = comp || { name: '', address: '', phone: '', contact_email: '' };
      
      // Petit hack pour forcer le refresh de l'image si elle a changé
      if (this.company.logo_url) {
        this.company.logo_url_display = this.getFullUrl(this.company.logo_url) + '?t=' + new Date().getTime();
      }

      this.docs = docs || [];
      this.checkGlobalStatus();
      this.isLoading = false;
    }).catch(err => {
      this.isLoading = false;
      console.error(err);
      this.presentToast('Erreur chargement données', 'danger');
    });
  }

  // --- LOGO GESTION ---
  triggerLogoUpload() { this.logoInput.nativeElement.click(); }
  onLogoDragOver(event: DragEvent) { event.preventDefault(); event.stopPropagation(); this.isLogoDragging = true; }
  onLogoDragLeave(event: DragEvent) { event.preventDefault(); event.stopPropagation(); this.isLogoDragging = false; }
  onLogoDrop(event: DragEvent) {
    event.preventDefault(); event.stopPropagation(); this.isLogoDragging = false;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.type.startsWith('image/')) this.processLogoUpload(file);
    }
  }

  onLogoSelected(event: any) {
    const file = event.target.files[0];
    if (file) this.processLogoUpload(file);
  }

  async processLogoUpload(file: File) {
    const load = await this.loadingCtrl.create({ message: 'Mise à jour du logo...' });
    await load.present();

    this.api.uploadLogo(file).subscribe({
      next: (res) => {
        if (this.company) {
            this.company.logo_url = res.url;
            this.company.logo_url_display = this.getFullUrl(res.url) + '?t=' + new Date().getTime();
        }
        load.dismiss();
        this.presentToast('Logo modifié ! 📸', 'success');
      },
      error: (err) => { 
        console.error(err);
        load.dismiss(); 
        this.presentToast('Erreur upload logo', 'danger'); 
      }
    });
  }

  // --- DOCS & HELPERS ---
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

  onFileSelected(event: any) { this.selectedFile = event.target.files[0]; }

  async uploadDoc() {
    if (!this.selectedFile || !this.newDoc.titre) return;
    const load = await this.loadingCtrl.create({ message: 'Envoi...' });
    await load.present();
    
    let dateExp = '';
    if (this.newDoc.date_expiration) {
        // Ion-datetime renvoie parfois l'heure, on coupe pour garder YYYY-MM-DD
        dateExp = String(this.newDoc.date_expiration).split('T')[0]; 
    }

    this.api.uploadCompanyDoc(this.selectedFile, this.newDoc.titre, this.newDoc.type_doc, dateExp).subscribe({
      next: (newDoc) => {
        this.docs.push(newDoc);
        this.checkGlobalStatus();
        this.closeUploadModal();
        load.dismiss();
        this.presentToast('Document ajouté ! ✅', 'success');
      },
      error: () => { load.dismiss(); this.presentToast('Erreur upload', 'danger'); }
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
      message: 'Veuillez saisir votre nom pour signer ce document.',
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
      componentProps: { type: 'generic', chantierId: 0 } // Id 0 car doc entreprise
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss(); 

    if (role === 'confirm' && data) {
        const load = await this.loadingCtrl.create({ message: 'Validation...' });
        await load.present();
        
        // data contient l'URL de la signature renvoyée par le composant
        this.api.signCompanyDoc(doc.id, nom, data).subscribe({
            next: () => { 
                load.dismiss(); 
                this.presentToast('Signé ! ✍️', 'success'); 
                // On met à jour l'icône ou le statut localement si besoin
            },
            error: () => { load.dismiss(); this.presentToast('Erreur lors de la signature', 'danger'); }
        });
    }
  }

  openDoc(url: string) { 
    const fullUrl = this.getFullUrl(url);
    window.open(fullUrl, '_system'); 
  }

  async deleteDoc(doc: any) {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer ?',
      message: 'Voulez-vous vraiment supprimer ce document ?',
      buttons: [
        { text: 'Non', role: 'cancel' },
        { text: 'Oui', role: 'destructive', handler: () => {
            this.api.deleteCompanyDoc(doc.id).subscribe(() => {
              this.docs = this.docs.filter(d => d.id !== doc.id);
              this.checkGlobalStatus();
              this.presentToast('Document supprimé', 'dark');
            });
        }}
      ]
    });
    await alert.present();
  }

  async saveInfos() {
    if (!this.company) return;
    const load = await this.loadingCtrl.create({ message: 'Sauvegarde...' });
    await load.present();
    
    // On crée un payload propre
    const payload = {
      name: this.company.name,
      address: this.company.address,
      contact_email: this.company.contact_email,
      phone: this.company.phone
    };

    this.api.updateCompany(payload).subscribe({
      next: (res) => { 
          load.dismiss(); 
          this.presentToast('Infos mises à jour ✅', 'success'); 
          if (res) this.company = { ...this.company, ...res };
      },
      error: (err) => { 
        load.dismiss(); 
        console.error(err);
        this.presentToast('Erreur serveur', 'danger'); 
      }
    });
  }
  
  // Helper pour construire l'URL complète
  getFullUrl(path: string | undefined): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    // Si c'est un chemin relatif (ex: uploads/...), on ajoute l'URL de l'API
    return `${this.api.apiUrl}/${path}`;
  }

  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 2000, color, position: 'bottom' });
    t.present();
  }
}