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
  cloudUploadOutline, list, chevronForward, image 
} from 'ionicons/icons';
import { ApiService } from '../../services/api'; // Adaptez si nécessaire
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
      cloudUploadOutline, list, chevronForward, image 
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
      this.api.getCompanyDocs().toPromise()
    ]).then(([user, comp, docs]) => {
      this.company = comp || null; 
      if (!this.company && user && user.company_id) {
          console.warn("ID trouvé mais objet manquant ?");
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
            // ASTUCE : On ajoute un timestamp pour forcer le rafraîchissement de l'image
            // Sinon le navigateur garde l'ancien logo en cache
            this.company.logo_url = res.url + '?t=' + new Date().getTime();
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
    const fullUrl = url.startsWith('http') ? url : `${this.api.apiUrl}/${url}`;
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

  async saveInfos() {
    if (!this.company) return;
    const load = await this.loadingCtrl.create({ message: 'Sauvegarde...' });
    await load.present();
    
    // 👇 CORRECTION : On crée un objet "propre" avec seulement les champs modifiables
    // Cela évite d'envoyer l'ID, le logo_url ou d'autres champs techniques qui bloquent l'API
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
          // On met à jour l'affichage local si le serveur a renvoyé des données formatées
          if (res) this.company = { ...this.company, ...res };
      },
      error: (err) => { 
        load.dismiss(); 
        console.error('Erreur Save:', err);
        // Affiche le détail de l'erreur si dispo
        const msg = err.error?.detail || 'Erreur lors de la sauvegarde';
        this.presentToast(msg, 'danger'); 
      }
    });
  }

  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 2000, color, position: 'bottom' });
    t.present();
  }
}