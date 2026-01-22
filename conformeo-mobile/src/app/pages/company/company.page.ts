import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router'; 
import { 
  IonicModule, AlertController, ToastController, LoadingController, ModalController 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
// 👇 Importation de toutes les icônes utilisées
import { 
  business, documentText, cloudUpload, trash, shieldCheckmark, 
  briefcase, warning, calendar, eye, pencil, add, folderOpen, close, camera, 
  cloudUploadOutline, list, chevronForward, image, logOutOutline,
  location, mail, call, save
} from 'ionicons/icons';
import { ApiService } from '../../services/api'; 
import { SignatureModalComponent } from '../chantier-details/signature-modal/signature-modal.component';

@Component({
  selector: 'app-company',
  templateUrl: './company.page.html',
  styleUrls: ['./company.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterLink]
})
export class CompanyPage implements OnInit {

  segment = 'infos';
  company: any = {
    name: '',
    address: '',
    phone: '',
    contact_email: '', // On force l'initialisation
    logo_url: ''
  };
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
    // 👇 Enregistrement des icônes pour qu'elles s'affichent
    addIcons({ 
      business, documentText, cloudUpload, trash, shieldCheckmark, 
      briefcase, warning, calendar, eye, pencil, add, folderOpen, close, camera, 
      cloudUploadOutline, list, chevronForward, image, logOutOutline,
      location, mail, call, save
    });
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    Promise.all([
      this.api.getMe().toPromise(),
      this.api.getMyCompany().toPromise().catch(() => null),
      this.api.getCompanyDocs().toPromise().catch(() => [])
    ]).then(([user, comp, docs]) => {
      
      if (comp) {
        this.company = comp;
        
        // 👇 FIX EMAIL : Si l'API renvoie 'email' (table users/companies), on le met dans 'contact_email'
        if (!this.company.contact_email && this.company.email) {
            this.company.contact_email = this.company.email;
        }
      }

      this.docs = docs || [];
      this.checkGlobalStatus();
      this.isLoading = false;
    }).catch(err => {
      this.isLoading = false;
      console.error(err);
    });
  }

  // --- LOGO GESTION ---
  triggerLogoUpload() { this.logoInput.nativeElement.click(); }
  
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
            // On met à jour l'URL avec un timestamp pour forcer le rafraîchissement visuel
            this.company.logo_url = res.url;
        }
        load.dismiss();
        this.presentToast('Logo modifié ! 📸', 'success');
      },
      error: (err) => { 
        load.dismiss(); 
        this.presentToast('Erreur upload logo', 'danger'); 
      }
    });
  }

  // 👇 FIX URL LOGO : Gère Cloudinary (http) et Local (uploads/)
  getFullUrl(path: string | undefined): string {
    if (!path) return '';
    
    // Si c'est déjà une URL complète (Cloudinary), on la retourne
    if (path.startsWith('http')) {
        // Petit hack cache : si on vient d'uploader, on ajoute un timestamp
        if (!path.includes('?')) return path + '?t=' + new Date().getTime();
        return path;
    }
    
    // Sinon c'est une image locale, on ajoute le domaine de l'API
    return `${this.api.apiUrl}/${path}`;
  }

  // --- SAUVEGARDE INFOS ---
  async saveInfos() {
    if (!this.company) return;
    const load = await this.loadingCtrl.create({ message: 'Sauvegarde...' });
    await load.present();
    
    // 👇 On envoie explicitement les champs corrects
    const payload = {
      name: this.company.name,
      address: this.company.address,
      contact_email: this.company.contact_email, // Le champ que le backend attend
      phone: this.company.phone
    };

    this.api.updateCompany(payload).subscribe({
      next: (res) => { 
          load.dismiss(); 
          this.presentToast('Infos mises à jour ✅', 'success'); 
          // Mise à jour locale
          if (res) {
             this.company = { ...this.company, ...res };
             // Re-map de l'email si besoin
             if(!this.company.contact_email && res.email) this.company.contact_email = res.email;
          }
      },
      error: (err) => { 
        load.dismiss(); 
        this.presentToast('Erreur serveur', 'danger'); 
      }
    });
  }

  // --- RESTE DU CODE (DOCS, ETC.) ---
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
    let dateExp = undefined;
    if (this.newDoc.date_expiration) dateExp = String(this.newDoc.date_expiration).split('T')[0]; 

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

  openDoc(url: string) { 
    const fullUrl = this.getFullUrl(url);
    window.open(fullUrl, '_system'); 
  }

  async deleteDoc(doc: any) {
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

  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 2000, color, position: 'bottom' });
    t.present();
  }
}