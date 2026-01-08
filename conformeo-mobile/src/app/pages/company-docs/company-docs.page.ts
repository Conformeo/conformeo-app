import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { ApiService } from '../../services/api'
import { addIcons } from 'ionicons';
import { add, trash, eye, cloudUploadOutline, warning, calendarOutline, folderOpenOutline, shieldCheckmark, business, documentText } from 'ionicons/icons';
import { format, differenceInDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

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

  constructor(private api: ApiService, private toastCtrl: ToastController) {
    addIcons({ add, trash, eye, cloudUploadOutline, warning, calendarOutline, folderOpenOutline, shieldCheckmark, business, documentText });
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

  // Calcul visuel pour les dates
  getExpirationStatus(dateStr: string) {
    if (!dateStr) return { text: 'Valide', color: 'success-badge' };
    
    const expDate = parseISO(dateStr);
    const today = new Date();
    const daysLeft = differenceInDays(expDate, today);

    if (daysLeft < 0) return { text: `Expiré depuis ${Math.abs(daysLeft)}j`, color: 'danger-badge' };
    if (daysLeft < 30) return { text: `Expire dans ${daysLeft}j`, color: 'warning-badge' };
    return { text: `Valide (${format(expDate, 'dd/MM/yy')})`, color: 'success-badge' };
  }

  checkGlobalStatus() {
    this.hasExpiredDocs = this.documents.some(d => d.date_expiration && new Date(d.date_expiration) < new Date());
  }

  getIcon(type: string) {
    switch(type) {
      case 'DUERP': return 'shield-checkmark';
      case 'ASSURANCE': return 'document-text';
      case 'KBIS': return 'business';
      default: return 'folder-open-outline';
    }
  }

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
      // On garde juste YYYY-MM-DD
      formData.append('date_expiration', this.newDoc.date_expiration.split('T')[0]);
    }

    this.api.http.post(`${this.api.apiUrl}/companies/me/documents`, formData).subscribe({
      next: () => {
        this.loadDocs();
        this.isModalOpen = false;
        this.newDoc = { titre: '', type_doc: 'AUTRE', date_expiration: '' };
        this.selectedFile = null;
        this.showToast('Document ajouté !', 'success');
      },
      error: () => this.showToast('Erreur upload', 'danger')
    });
  }

  deleteDoc(id: number) {
    if(!confirm("Supprimer ce document ?")) return;
    this.api.http.delete(`${this.api.apiUrl}/companies/me/documents/${id}`).subscribe(() => {
      this.loadDocs();
    });
  }

  openDoc(url: string) {
    window.open(url, '_blank');
  }

  async showToast(msg: string, color: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, color: color });
    t.present();
  }
}