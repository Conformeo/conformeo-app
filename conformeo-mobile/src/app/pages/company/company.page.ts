import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonicModule, AlertController, ToastController, LoadingController, ModalController 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  business, documentText, cloudUpload, trash, shieldCheckmark, 
  briefcase, warning, calendar, eye, pencil, add, folderOpen 
} from 'ionicons/icons';
import { ApiService, Company, CompanyDoc } from '../../services/api';
// 👇 Assurez-vous que le chemin est bon pour votre module de signature
import { SignatureModalComponent } from '../chantier-details/signature-modal/signature-modal.component';

@Component({
  selector: 'app-company',
  templateUrl: './company.page.html',
  styleUrls: ['./company.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class CompanyPage implements OnInit {

  segment = 'infos'; // 'infos' ou 'docs'
  company: Company | null = null;
  docs: CompanyDoc[] = [];
  
  isLoading = false;
  hasExpiredDocs = false;

  // Pour le Modal d'upload
  isUploadModalOpen = false;
  newDoc = { titre: '', type_doc: 'AUTRE', date_expiration: '' };
  selectedFile: File | null = null;

  constructor(
    private api: ApiService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private modalCtrl: ModalController
  ) {
    addIcons({ 
      business, documentText, cloudUpload, trash, shieldCheckmark, 
      briefcase, warning, calendar, eye, pencil, add, folderOpen 
    });
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    
    // On charge Infos ET Docs en parallèle
    Promise.all([
      this.api.getMyCompany().toPromise(),
      this.api.getCompanyDocs().toPromise()
    ]).then(([comp, docs]) => {
      this.company = comp || null;
      this.docs = docs || [];
      this.checkGlobalStatus(); // Vérifier les dates
      this.isLoading = false;
    }).catch(err => {
      this.isLoading = false;
      console.error(err);
    });
  }

  // --- PARTIE 1 : INFOS ENTREPRISE ---

  async saveInfos() {
    if (!this.company) return;
    const load = await this.loadingCtrl.create({ message: 'Sauvegarde...' });
    await load.present();
    
    this.api.updateCompany(this.company).subscribe({
      next: () => {
        load.dismiss();
        this.presentToast('Informations mises à jour ✅', 'success');
      },
      error: () => {
        load.dismiss();
        this.presentToast('Erreur de sauvegarde', 'danger');
      }
    });
  }

  // --- PARTIE 2 : LOGIQUE DOCUMENTS (Expiration & Design) ---

  checkGlobalStatus() {
    // Vérifie si au moins un doc est périmé
    this.hasExpiredDocs = this.docs.some(d => {
        if(!d.date_expiration) return false;
        return new Date(d.date_expiration) < new Date();
    });
  }

  getExpirationStatus(dateStr?: string) {
    if (!dateStr) return { text: 'Date non définie', color: 'medium' };
    
    const expDate = new Date(dateStr); 
    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return { text: `Expiré (${Math.abs(daysLeft)}j)`, color: 'danger' };
    if (daysLeft < 30) return { text: `Expire ds ${daysLeft}j`, color: 'warning' };
    
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

  // --- PARTIE 3 : UPLOAD VIA MODAL ---

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  async uploadDoc() {
    if (!this.selectedFile) return;

    const load = await this.loadingCtrl.create({ message: 'Envoi...' });
    await load.present();

    // Formatage de la date pour le backend si nécessaire
    let dateExp = undefined;
    if (this.newDoc.date_expiration) {
      dateExp = this.newDoc.date_expiration.split('T')[0]; 
    }

    this.api.uploadCompanyDoc(this.selectedFile, this.newDoc.titre, this.newDoc.type_doc, dateExp).subscribe({
      next: (newDoc) => {
        this.docs.push(newDoc);
        this.checkGlobalStatus();
        this.isUploadModalOpen = false;
        this.newDoc = { titre: '', type_doc: 'AUTRE', date_expiration: '' };
        this.selectedFile = null;
        load.dismiss();
        this.presentToast('Document ajouté ! ✅', 'success');
      },
      error: () => {
        load.dismiss();
        this.presentToast('Erreur upload', 'danger');
      }
    });
  }

  // --- PARTIE 4 : ACTIONS (Supprimer, Ouvrir, Signer) ---

  async deleteDoc(doc: CompanyDoc) {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer ?',
      message: `Voulez-vous supprimer "${doc.titre}" ?`,
      buttons: [
        { text: 'Non', role: 'cancel' },
        {
          text: 'Oui',
          role: 'destructive',
          handler: () => {
            this.api.deleteCompanyDoc(doc.id).subscribe(() => {
              this.docs = this.docs.filter(d => d.id !== doc.id);
              this.checkGlobalStatus();
              this.presentToast('Supprimé', 'medium');
            });
          }
        }
      ]
    });
    await alert.present();
  }

  openDoc(url: string) {
    window.open(url, '_system');
  }

  // Signature (Feature avancée)
  async signDocument(doc: any) {
    const alert = await this.alertCtrl.create({
      header: 'Faire signer',
      inputs: [ { name: 'nom', type: 'text', placeholder: 'Nom du signataire' } ],
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Continuer', handler: (data) => {
            if(data.nom) this.openSignaturePad(doc, data.nom);
        }}
      ]
    });
    await alert.present();
  }

  // ... Dans CompanyPage

  async openSignaturePad(doc: CompanyDoc, nom: string) {
    const modal = await this.modalCtrl.create({
      component: SignatureModalComponent,
      componentProps: { 
        type: 'generic', // 👈 Important : dit au composant de ne pas sauvegarder le chantier
        chantierId: 0    // On met 0 car ce n'est pas lié à un chantier
      }
    });

    await modal.present();
    
    // On récupère l'URL renvoyée par votre composant (qui a géré l'upload Cloudinary)
    const { data, role } = await modal.onWillDismiss(); 

    if (role === 'confirm' && data) {
        // data contient l'URL Cloudinary de la signature
        const loading = await this.loadingCtrl.create({ message: 'Validation...' });
        await loading.present();

        this.api.signCompanyDoc(doc.id, nom, data).subscribe({
            next: () => {
                loading.dismiss();
                this.presentToast('Document signé et validé ! ✍️✅', 'success');
                this.loadData(); // Recharger pour voir la mise à jour (si vous affichez l'état signé)
            },
            error: () => {
                loading.dismiss();
                this.presentToast('Erreur lors de la sauvegarde de la signature', 'danger');
            }
        });
    }
  }
  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 2000, color, position: 'bottom' });
    t.present();
  }
}