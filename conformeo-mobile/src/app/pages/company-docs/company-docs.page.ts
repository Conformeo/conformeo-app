import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, ModalController, AlertController } from '@ionic/angular';
// 👇 VOTRE SERVICE
import { ApiService } from '../../services/api';
// 👇 VOTRE MODULE SIGNATURE EXISTANT
import { SignatureModalComponent } from '../chantier-details/signature-modal/signature-modal.component';

import { addIcons } from 'ionicons';
import { add, trash, eye, cloudUploadOutline, warning, calendarOutline, folderOpenOutline, shieldCheckmark, business, documentText, pencil, checkmarkCircle, folderOpen } from 'ionicons/icons';
import { format, differenceInDays, parseISO } from 'date-fns';

@Component({
  selector: 'app-company-docs',
  templateUrl: './company-docs.page.html',
  styleUrls: ['./company-docs.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class CompanyDocsPage implements OnInit {
  documents: any[] = [];
  isModalOpen = false;
  hasExpiredDocs = false;

  newDoc = { titre: '', type_doc: 'AUTRE', date_expiration: '' };
  selectedFile: File | null = null;

  constructor(
    public api: ApiService, // Public pour le template
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController
  ) {
    addIcons({ add, trash, eye, cloudUploadOutline, warning, calendarOutline, folderOpenOutline, shieldCheckmark, business, documentText, pencil, checkmarkCircle, folderOpen });
  }

  ngOnInit() {
    this.loadDocs();
  }

  loadDocs() {
    this.api.http.get<any[]>(`${this.api.apiUrl}/companies/me/documents`).subscribe(data => {
      this.documents = data;
      this.checkGlobalStatus();
    });
  }

  // --- LOGIQUE VISUELLE (Badge couleur) ---
  getExpirationStatus(dateStr: string) {
    if (!dateStr) return { text: 'Date non définie', color: 'neutral-badge' };
    
    // Si la date vient du backend en string ISO
    const expDate = new Date(dateStr); 
    const today = new Date();
    // On calcule la différence en jours
    const diffTime = expDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return { text: `Expiré (${Math.abs(daysLeft)}j)`, color: 'danger-badge' };
    if (daysLeft < 30) return { text: `Expire ds ${daysLeft}j`, color: 'warning-badge' };
    
    // Formatage simple JJ/MM/AAAA
    const dateFmt = expDate.toLocaleDateString('fr-FR');
    return { text: `Valide (${dateFmt})`, color: 'success-badge' };
  }

  checkGlobalStatus() {
    this.hasExpiredDocs = this.documents.some(d => {
        if(!d.date_expiration) return false;
        return new Date(d.date_expiration) < new Date();
    });
  }

  getIcon(type: string) {
    switch(type) {
      case 'DUERP': return 'shield-checkmark';
      case 'ASSURANCE': return 'document-text';
      case 'KBIS': return 'business';
      default: return 'folder-open';
    }
  }

  // --- GESTION UPLOAD ---
  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  uploadDoc() {
    if (!this.selectedFile) return;

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('titre', this.newDoc.titre);
    formData.append('type_doc', this.newDoc.type_doc);
    if (this.newDoc.date_expiration) {
      // Nettoyage format ISO
      const dateClean = this.newDoc.date_expiration.split('T')[0]; 
      formData.append('date_expiration', dateClean);
    }

    this.api.http.post(`${this.api.apiUrl}/companies/me/documents`, formData).subscribe({
      next: () => {
        this.loadDocs();
        this.isModalOpen = false;
        this.newDoc = { titre: '', type_doc: 'AUTRE', date_expiration: '' };
        this.selectedFile = null;
        this.showToast('Document ajouté ! ✅', 'success');
      },
      error: () => this.showToast('Erreur upload', 'danger')
    });
  }

  // --- SUPPRESSION ---
  async deleteDoc(id: number) {
    const alert = await this.alertCtrl.create({
        header: 'Supprimer ?',
        message: 'Cette action est irréversible.',
        buttons: [
            { text: 'Annuler', role: 'cancel' },
            { text: 'Supprimer', role: 'destructive', handler: () => {
                this.api.http.delete(`${this.api.apiUrl}/companies/me/documents/${id}`).subscribe(() => {
                    this.loadDocs();
                    this.showToast('Document supprimé', 'medium');
                });
            }}
        ]
    });
    await alert.present();
  }

  openDoc(url: string) {
    window.open(url, '_blank');
  }

  // --- SIGNATURE (Module existant) ---
  async signDocument(doc: any) {
    // 1. Demander le nom
    const alert = await this.alertCtrl.create({
      header: 'Faire signer',
      message: 'Qui signe ce document ?',
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

  async openSignaturePad(doc: any, nom: string) {
    const modal = await this.modalCtrl.create({
      component: SignatureModalComponent,
      componentProps: { 
        type: 'generic' // 👈 IMPORTANT : Utilise le mode générique de votre module
      }
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss(); // data = URL Signature

    if (role === 'confirm' && data) {
        // Envoi au backend
        const payload = { nom_signataire: nom, signature_url: data };
        this.api.http.post(`${this.api.apiUrl}/companies/documents/${doc.id}/sign`, payload).subscribe({
            next: () => this.showToast('Signature enregistrée ! ✍️', 'success'),
            error: () => this.showToast('Erreur signature', 'danger')
        });
    }
  }

  async showToast(msg: string, color: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, color: color });
    t.present();
  }
}