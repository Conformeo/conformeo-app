import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController, LoadingController, ToastController, NavController } from '@ionic/angular';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, Rapport, Chantier, PPSPS, Materiel } from '../../services/api';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Platform } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { IonBackButton, IonButtons } from '@ionic/angular/standalone';
import { AddChantierModalComponent } from 'src/app/home/add-chantier-modal/add-chantier-modal.component';
import { TaskListComponent } from '../../components/task-list/task-list.component';

import { 
  camera, time, warning, documentText, create, navigate, 
  location, arrowBack, createOutline, trashOutline,
  scanOutline, checkmarkCircle, shieldCheckmark, downloadOutline,
  shieldCheckmarkOutline, map, checkmarkDoneCircle,
  checkmarkDoneCircleOutline, documentLockOutline,
  documentTextOutline, archiveOutline, mapOutline, hammerOutline, mail,
  cloudUpload, trash, ribbon, book, construct, download, addCircle,
  checkboxOutline, flame
} from 'ionicons/icons';

import { PicModalComponent } from './pic-modal/pic-modal.component';
import { NewRapportModalComponent } from './new-rapport-modal/new-rapport-modal.component';
import { RapportDetailsModalComponent } from './rapport-details-modal/rapport-details-modal.component';
import { SignatureModalComponent } from './signature-modal/signature-modal.component';

// Interface locale pour l'affichage (match avec le backend)
interface DocExterne {
  id: number;
  titre: string;
  url: string;
  categorie: string; 
  date_ajout: string;
}

@Component({
  selector: 'app-chantier-details',
  templateUrl: './chantier-details.page.html',
  styleUrls: ['./chantier-details.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, IonButtons, IonBackButton, RouterLink, TaskListComponent]
})
export class ChantierDetailsPage implements OnInit {
  chantierId: number = 0;
  
  chantier: Chantier | undefined; 
  rapports: Rapport[] = [];
  documentsList: any[] = [];
  ppspsList: PPSPS[] = [];
  materielsSurSite: Materiel[] = []; 

  segment = 'suivi'; 
  
  // --- GESTION DOE ---
  docsExternes: DocExterne[] = []; // Liste typée
  currentUploadCategory = ''; // Catégorie en cours d'upload
  
  @ViewChild('doeFileInput') fileInput!: ElementRef;
  
  constructor(
    private route: ActivatedRoute,
    public api: ApiService,
    private modalCtrl: ModalController,
    private platform: Platform,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController
  ) {
    addIcons({ 
      'camera': camera, 'time': time, 'warning': warning, 
      'document-text': documentText, 'create': create, 'navigate': navigate, 
      'location': location, 'arrow-back': arrowBack, 
      'document-text-outline': documentTextOutline, 'create-outline': createOutline, 
      'scan-outline': scanOutline, 'checkmark-circle': checkmarkCircle, 
      'shield-checkmark': shieldCheckmark, 'download-outline': downloadOutline, 
      'archive-outline': archiveOutline, 'shield-checkmark-outline': shieldCheckmarkOutline, 
      'map': map, 'map-outline': mapOutline, 'trash-outline': trashOutline,
      'checkmark-done-circle': checkmarkDoneCircle, 'checkmark-done-circle-outline': checkmarkDoneCircleOutline,
      'hammer-outline': hammerOutline, 'document-lock-outline': documentLockOutline,
      'mail': mail, 'cloud-upload': cloudUpload, 'trash': trash,
      'ribbon': ribbon, 'book': book, 'construct': construct, 'download': download,
      'add-circle': addCircle,
      'checkbox-outline': checkboxOutline,
      'flame': flame
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.chantierId = +id;
      this.loadData();
    }
  }

  ionViewWillEnter() {
    if (this.api.needsRefresh) {
      this.loadData();
      this.api.needsRefresh = false;
    }
  }

  loadData() {
    // 1. Infos Chantier
    this.api.getChantierById(this.chantierId).subscribe(data => {
      this.chantier = data;
      this.buildDocumentsList(); 
    });

    // 2. Rapports
    this.loadRapports();

    // 3. Matériel
    this.api.getMateriels().subscribe(allMat => {
      this.materielsSurSite = allMat.filter(m => m.chantier_id === this.chantierId);
    });

    // 4. DOE (Documents Externes)
    this.loadDoeDocs();
  }

  loadRapports() {
    this.api.getRapports(this.chantierId).subscribe(data => {
      this.rapports = data.sort((a, b) => 
        new Date(b.date_creation || 0).getTime() - new Date(a.date_creation || 0).getTime()
      );
    });
  }

  // ==========================================
  // 📂 GESTION DOE (DOCUMENTS EXTERNES)
  // ==========================================

  loadDoeDocs() {
    this.api.getChantierDocs(this.chantierId).subscribe(data => {
      this.docsExternes = data;
    });
  }

  // Helpers pour le HTML
  getDocs(cat: string) {
    return this.docsExternes.filter(d => d.categorie === cat);
  }
  
  getCount(cat: string) {
    return this.getDocs(cat).length;
  }

  // 1. Déclenche l'ouverture de l'explorateur de fichiers
  uploadDoeDoc(category: string) {
    this.currentUploadCategory = category;
    // On clique virtuellement sur l'input caché dans le HTML
    if (this.fileInput) {
        this.fileInput.nativeElement.click();
    }
  }

  // 2. Une fois le fichier choisi, on demande le nom
  async onDoeFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const alert = await this.alertCtrl.create({
      header: 'Nom du document',
      inputs: [ 
        { 
          name: 'titre', 
          type: 'text', 
          placeholder: 'Ex: Plan RDC', 
          value: file.name 
        } 
      ],
      buttons: [
        { 
          text: 'Annuler', 
          role: 'cancel',
          handler: () => { event.target.value = ''; } // Reset input
        },
        { 
          text: 'Envoyer', 
          handler: (data) => {
            const titre = data.titre || file.name;
            this.processUpload(file, titre, event);
          }
        }
      ]
    });
    await alert.present();
  }

  // 3. Envoi au serveur via ApiService
  async processUpload(file: File, titre: string, eventInput: any) {
    const loading = await this.loadingCtrl.create({ message: 'Envoi en cours...' });
    await loading.present();

    this.api.uploadChantierDoc(this.chantierId, file, this.currentUploadCategory, titre).subscribe({
      next: (newDoc) => {
        // On ajoute directement à la liste locale pour éviter un rechargement complet
        this.docsExternes.push(newDoc);
        loading.dismiss();
        this.presentToast('Document ajouté au DOE ! 📂', 'success');
        eventInput.target.value = ''; // Reset de l'input file
      },
      error: (err) => {
        console.error(err);
        loading.dismiss();
        this.presentToast('Erreur lors de l\'envoi ❌', 'danger');
        eventInput.target.value = '';
      }
    });
  }

  async deleteDoc(docId: number) {
    const alert = await this.alertCtrl.create({
        header: 'Supprimer ?',
        message: 'Ce document sera définitivement effacé.',
        buttons: [
          { text: 'Annuler', role: 'cancel' },
          {
            text: 'Supprimer',
            role: 'destructive',
            handler: () => {
              this.api.deleteDoc(docId).subscribe({
                next: () => {
                    this.docsExternes = this.docsExternes.filter(d => d.id !== docId);
                    this.presentToast('Document supprimé', 'dark');
                },
                error: () => this.presentToast('Erreur suppression', 'danger')
              });
            }
          }
        ]
      });
      await alert.present();
  }

  downloadFullDoe() {
    this.presentToast('Préparation du ZIP DOE...', 'primary');
    const url = `${this.api.apiUrl}/chantiers/${this.chantierId}/doe`;
    window.open(url, '_system');
  }

  // ==========================================
  // 📄 LISTE DOCUMENTS SÉCURITÉ (Onglet DOE)
  // ==========================================
  buildDocumentsList() {
    this.documentsList = [];
    
    // 1. Journal
    this.documentsList.push({
        type: 'RAPPORT',
        titre: 'Journal de Bord (Photos & QHSE)',
        date: new Date().toISOString(), 
        icon: 'document-text-outline',
        color: 'primary',
        action: () => this.downloadPdf()
    });

    // 2. PPSPS
    this.api.getPPSPSList(this.chantierId).subscribe(docs => {
        this.ppspsList = docs;
        docs.forEach(doc => {
            this.documentsList.push({
                type: 'PPSPS',
                titre: 'PPSPS Officiel',
                date: doc.date_creation,
                icon: 'shield-checkmark-outline',
                color: 'warning',
                action: () => this.downloadPPSPS(doc.id!)
            });
        });
    });

    // 3. Plan de Prévention (PdP)
    // On ajoute aussi les PdP s'ils existent
    this.api.getPdp(this.chantierId).subscribe(pdps => {
        pdps.forEach(pdp => {
            this.documentsList.push({
                type: 'PDP',
                titre: 'Plan de Prévention',
                date: pdp.date_creation,
                icon: 'document-lock-outline',
                color: 'tertiary',
                action: () => {
                    const token = localStorage.getItem('access_token') || '';
                    const url = `${this.api.apiUrl}/plans-prevention/${pdp.id}/pdf?token=${token}`;
                    window.open(url, '_system');
                }
            });
        });
    });

    // 4. PIC
    this.api.getPIC(this.chantierId).subscribe(pic => {
        if (pic && pic.final_url) {
            this.documentsList.push({
                type: 'PIC',
                titre: 'Plan Installation (PIC)',
                date: new Date().toISOString(),
                icon: 'map-outline',
                color: 'tertiary',
                action: () => window.open(this.getFullUrl(pic.final_url!), '_system')
            });
        }
    });

    // 5. Audits
    this.api.getInspections(this.chantierId).subscribe(audits => {
        audits.forEach(audit => {
            this.documentsList.push({
                type: 'AUDIT',
                titre: `Audit ${audit.type}`,
                date: audit.date_creation,
                icon: 'checkmark-done-circle-outline', 
                color: 'success',
                action: () => {
                    const url = `${this.api.apiUrl}/inspections/${audit.id}/pdf`;
                    window.open(url, '_system');
                }
            });
        });
    });

    // 6. Permis Feu
    this.api.getPermisFeuList(this.chantierId).subscribe(permisList => {
        permisList.forEach(p => {
            this.documentsList.push({
                type: 'PERMIS',
                titre: `Permis Feu - ${p.lieu}`,
                date: p.date,
                icon: 'flame',
                color: 'danger',
                action: () => {
                    const url = `${this.api.apiUrl}/permis-feu/${p.id}/pdf`;
                    window.open(url, '_system');
                }
            });
        });
    });

    // 7. Signature Client
    if (this.chantier && this.chantier.signature_url) {
        this.documentsList.push({
            type: 'SIGNATURE',
            titre: 'Signature Client',
            date: this.chantier.date_creation,
            icon: 'create-outline',
            color: 'medium',
            action: () => window.open(this.getFullUrl(this.chantier!.signature_url), '_system')
        });
    }
  }

  // ==========================================
  // ⚙️ ACTIONS DIVERSES
  // ==========================================

  async takePhoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 90, allowEditing: false, resultType: CameraResultType.Uri, source: CameraSource.Camera, correctOrientation: true
      });
      if (image.webPath) {
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        this.uploadAndCreateRapport(blob, image.webPath);
      }
    } catch (e) { console.log('Annulé', e); }
  }

  updateStatus(event: any) {
    const newVal = event.detail.value;
    if (this.chantier && this.chantier.est_actif !== newVal) {
        this.api.updateChantier(this.chantierId, { est_actif: newVal }).subscribe(() => {
            this.chantier!.est_actif = newVal;
            const msg = newVal ? 'Chantier réactivé ✅' : 'Chantier terminé 🏁';
            this.presentToast(msg);
        });
    }
  }

  async uploadAndCreateRapport(blob: Blob, webPath: string) {
    const modal = await this.modalCtrl.create({
      component: NewRapportModalComponent,
      componentProps: { initialPhotoWebPath: webPath, initialPhotoBlob: blob }
    });
    
    await modal.present();
    const result = await modal.onWillDismiss();

    if (result.role === 'confirm' && result.data) {
      const { data, gps, blobs } = result.data; 
      
      const newRapport: Rapport = {
        titre: data.titre,
        description: data.description,
        chantier_id: this.chantierId,
        niveau_urgence: data.niveau_urgence,
        latitude: gps ? gps.latitude : null,
        longitude: gps ? gps.longitude : null
      };

      await this.api.addRapportWithMultiplePhotos(newRapport, blobs);
      setTimeout(() => { this.loadRapports(); }, 500);
      this.api.needsRefresh = true;
    }
  }

  openItinerary() {
    if (!this.chantier?.adresse) { alert("Adresse introuvable."); return; }
    const destination = encodeURIComponent(this.chantier.adresse);
    let url = '';
    if (this.platform.is('ios') || this.platform.is('ipad') || this.platform.is('iphone')) {
      url = `maps:?q=${destination}`;
    } else if (this.platform.is('android')) {
      url = `geo:0,0?q=${destination}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=$${destination}`;
    }
    window.open(url, '_system');
  }

  async editChantier() {
    const modal = await this.modalCtrl.create({
      component: AddChantierModalComponent,
      componentProps: { existingChantier: this.chantier }
    });
    
    await modal.present();
    const { role, data } = await modal.onWillDismiss();
    
    if (role === 'confirm' && data) {
      this.chantier = data; 
      this.api.needsRefresh = true; 
    }
  }
  
  downloadPdf() {
    // Note: Utilisation token URL pour accès mobile facile
    const token = localStorage.getItem('access_token');
    const url = `${this.api.apiUrl}/chantiers/${this.chantierId}/pdf?token=${token}`;
    window.open(url, '_system');
  }

  downloadPPSPS(docId: number) {
    const token = localStorage.getItem('access_token');
    const url = `${this.api.apiUrl}/ppsps/${docId}/pdf?token=${token}`;
    window.open(url, '_system');
  }

  async openPIC() {
    const modal = await this.modalCtrl.create({
      component: PicModalComponent,
      componentProps: { chantierId: this.chantierId }
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (this.api.needsRefresh) { this.loadData(); this.api.needsRefresh = false; }
  }

  async openSignature() {
    const modal = await this.modalCtrl.create({
      component: SignatureModalComponent,
      componentProps: { chantierId: this.chantierId }
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (this.api.needsRefresh) { this.loadData(); this.api.needsRefresh = false; }
  }

  async openRapportDetails(rapport: Rapport) {
    const modal = await this.modalCtrl.create({
      component: RapportDetailsModalComponent,
      componentProps: { rapport: rapport }
    });
    modal.present();
  }

  async presentToast(message: string, color: string = 'dark') {
    const toast = await this.toastCtrl.create({
      message: message, duration: 2000, position: 'bottom', color: color
    });
    toast.present();
  }

  async sendJournal() {
    const alert = await this.alertCtrl.create({
      header: 'Envoyer le Rapport',
      message: 'Email du destinataire :',
      inputs: [ { name: 'email', type: 'email', placeholder: 'client@chantier.com', value: this.chantier?.client?.includes('@') ? this.chantier.client : '' } ],
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Envoyer', handler: (data) => { if (data.email) this.processEmail(data.email); } }
      ]
    });
    await alert.present();
  }

  async processEmail(email: string) {
    const load = await this.loadingCtrl.create({ message: 'Envoi en cours...' });
    await load.present();
    this.api.sendJournalEmail(this.chantierId, email).subscribe({
      next: () => { load.dismiss(); this.presentToast('Rapport envoyé avec succès ! 📧'); },
      error: () => { load.dismiss(); this.presentToast('Erreur lors de l\'envoi', 'danger'); }
    });
  }

  async deleteChantier() {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer le chantier ?',
      message: 'Cette action est irréversible. Tous les rapports et documents seront effacés.',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: () => {
            this.api.deleteChantier(this.chantierId).subscribe(() => {
              this.navCtrl.navigateBack('/home');
            });
          }
        }
      ]
    });
    await alert.present();
  }

  getFullUrl(path: string | undefined) {
    if (!path) return '';
    if (path.startsWith('http')) {
      // Optimisation Cloudinary si possible
      if (path.includes('cloudinary.com')) {
        return path.replace('/upload/', '/upload/w_500,f_auto,q_auto/');
      }
      return path;
    }
    // Si chemin relatif
    return `${this.api.apiUrl}${path}`; 
  }

  hasImage(rap: Rapport): boolean {
    return (rap.images && rap.images.length > 0) || !!rap.photo_url;
  }

  getFirstImage(rap: Rapport): string {
    if (rap.images && rap.images.length > 0) {
      return this.getFullUrl(rap.images[0].url);
    }
    return this.getFullUrl(rap.photo_url);
  }
}