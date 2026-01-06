import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent, 
  IonList, IonItem, IonInput, IonLabel, IonButton, IonIcon, IonSegment, 
  IonSegmentButton, IonCard, IonCardContent, IonBadge, IonSpinner, 
  AlertController, ToastController, LoadingController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  business, documentText, cloudUpload, trash, shieldCheckmark, 
  briefcase, warning, calendar 
} from 'ionicons/icons';
import { ApiService, Company, CompanyDoc } from '../../services/api'

@Component({
  selector: 'app-company',
  templateUrl: './company.page.html',
  styleUrls: ['./company.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent,
    IonList, IonItem, IonInput, IonLabel, IonButton, IonIcon, IonSegment,
    IonSegmentButton, IonCard, IonCardContent, IonBadge, IonSpinner
  ]
})
export class CompanyPage implements OnInit {

  @ViewChild('fileInput') fileInput!: ElementRef;

  segment = 'infos'; // 'infos' ou 'docs'
  company: Company | null = null;
  docs: CompanyDoc[] = [];
  isLoading = false;

  constructor(
    private api: ApiService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {
    addIcons({ business, documentText, cloudUpload, trash, shieldCheckmark, briefcase, warning, calendar });
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    // Charge Infos + Docs en parallèle
    Promise.all([
      this.api.getMyCompany().toPromise(),
      this.api.getCompanyDocs().toPromise()
    ]).then(([comp, docs]) => {
      this.company = comp || null;
      this.docs = docs || [];
      this.isLoading = false;
    }).catch(err => {
      this.isLoading = false;
      console.error(err);
    });
  }

  // --- MISE A JOUR INFOS ---
  async saveInfos() {
    if (!this.company) return;
    const load = await this.loadingCtrl.create({ message: 'Sauvegarde...' });
    await load.present();
    
    this.api.updateCompany(this.company).subscribe({
      next: () => {
        load.dismiss();
        this.presentToast('Informations mises à jour ✅');
      },
      error: () => {
        load.dismiss();
        this.presentToast('Erreur de sauvegarde');
      }
    });
  }

  // --- GESTION DOCUMENTS ---
  triggerUpload() {
    this.fileInput.nativeElement.click();
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // 1. Demander le Type de document
    const alert = await this.alertCtrl.create({
      header: 'Type de document',
      inputs: [
        { type: 'radio', label: '📄 Kbis / SIRENE', value: 'Kbis', checked: true },
        { type: 'radio', label: '🛡️ Assurance Décennale / RC', value: 'Assurance' },
        { type: 'radio', label: '⚠️ DUERP (Document Unique)', value: 'DUERP' },
        { type: 'radio', label: '📁 Autre', value: 'Autre' }
      ],
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { 
          text: 'Suivant', 
          handler: (type) => this.askDetails(file, type) 
        }
      ]
    });
    await alert.present();
    
    // Reset l'input pour pouvoir ré-uploader le même fichier si besoin
    event.target.value = ''; 
  }

  async askDetails(file: File, type: string) {
    // Si c'est une assurance, on demande la date d'expiration
    const inputs: any[] = [
      { name: 'titre', type: 'text', placeholder: 'Nom (ex: Kbis 2026)', value: type }
    ];

    if (type === 'Assurance') {
      inputs.push({ 
        name: 'date_expiration', 
        type: 'date', 
        placeholder: 'Date expiration' 
      });
    }

    const alert = await this.alertCtrl.create({
      header: 'Détails',
      message: type === 'Assurance' ? 'Veuillez indiquer la date de validité.' : '',
      inputs: inputs,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Uploader',
          handler: (data) => this.upload(file, data.titre, type, data.date_expiration)
        }
      ]
    });
    await alert.present();
  }

  async upload(file: File, titre: string, type: string, expiration?: string) {
    const load = await this.loadingCtrl.create({ message: 'Envoi en cours...' });
    await load.present();

    this.api.uploadCompanyDoc(file, titre, type, expiration).subscribe({
      next: (newDoc) => {
        this.docs.push(newDoc);
        load.dismiss();
        this.presentToast('Document ajouté !');
      },
      error: (err) => {
        console.error(err);
        load.dismiss();
        this.presentToast('Erreur lors de l\'envoi');
      }
    });
  }

  async deleteDoc(doc: CompanyDoc) {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer ?',
      message: `Voulez-vous supprimer ${doc.titre} ?`,
      buttons: [
        { text: 'Non', role: 'cancel' },
        {
          text: 'Oui',
          handler: () => {
            this.api.deleteCompanyDoc(doc.id).subscribe(() => {
              this.docs = this.docs.filter(d => d.id !== doc.id);
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // Helpers
  openDoc(url: string) {
    window.open(url, '_blank');
  }

  isExpired(dateStr?: string): boolean {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }

  async presentToast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2000, position: 'bottom' });
    t.present();
  }
}