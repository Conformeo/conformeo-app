import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalController } from '@ionic/angular/standalone';
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, 
  IonList, IonListHeader, IonItem, IonInput, IonLabel, IonTextarea, 
  IonButton, IonIcon, IonDatetime, IonDatetimeButton, IonModal, 
  IonSelect, IonSelectOption, LoadingController, ToastController 
} from '@ionic/angular/standalone';
import { SignatureModalComponent } from '../chantier-details/signature-modal/signature-modal.component';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';
import { ApiService, PlanPrevention } from '../../services/api';
import { addIcons } from 'ionicons';
import { add, trash, save, download, mail, arrowBack, documentText } from 'ionicons/icons';

@Component({
  selector: 'app-pdp-form',
  templateUrl: './pdp-form.page.html',
  styleUrls: ['./pdp-form.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent,
    IonList, IonListHeader, IonItem, IonInput, IonLabel, IonTextarea,
    IonButton, IonIcon, IonDatetime, IonDatetimeButton, IonModal,
    IonSelect, IonSelectOption
  ]
})
export class PdpFormPage implements OnInit {

  chantierId: number = 0;
  
  // Modèle de données initial
  pdp: PlanPrevention = {
    chantier_id: 0,
    entreprise_utilisatrice: '',
    entreprise_exterieure: '', // Sera pré-rempli avec "Nous"
    date_inspection_commune: new Date().toISOString(),
    risques_interferents: [],
    consignes_securite: {
      urgence: '15 / 18',
      rassemblement: 'Parking Entrée',
      sanitaires: 'Accès autorisé',
      fumeur: 'Zone fumeur uniquement',
      permis_feu: 'Non'
    }
  };

  isExisting = false;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController
  ) {
    // Ajout des icônes manquantes
    addIcons({ add, trash, save, download, mail, arrowBack, documentText });
  }

  ngOnInit() {
    this.chantierId = Number(this.route.snapshot.paramMap.get('id'));
    this.pdp.chantier_id = this.chantierId;
    this.loadData();
  }

  loadData() {
    this.api.getPdp(this.chantierId).subscribe(list => {
      if (list && list.length > 0) {
        this.pdp = list[0]; // On prend le premier PdP trouvé
        this.isExisting = true;
        
        // Sécuriser les champs JSON s'ils sont null pour éviter les erreurs template
        if (!this.pdp.risques_interferents) this.pdp.risques_interferents = [];
        if (!this.pdp.consignes_securite) {
            this.pdp.consignes_securite = {
              urgence: '15 / 18',
              rassemblement: '',
              sanitaires: 'Accès autorisé',
              fumeur: 'Non',
              permis_feu: 'Non'
            };
        }
      } else {
        // Pré-remplissage intelligent si nouveau
        this.api.getChantiers().subscribe(chantiers => { 
            const c = chantiers.find(x => x.id === this.chantierId);
            if(c) {
                this.pdp.entreprise_utilisatrice = c.client; 
            }
        });
        
        // Pré-remplir avec le nom de ma compagnie
        this.api.getMyCompany().subscribe(comp => {
            if(comp) this.pdp.entreprise_exterieure = comp.name;
        });
      }
    });
  }

  // --- GESTION DES RISQUES ---
  addRisk() {
    this.pdp.risques_interferents.push({ tache: '', risque: '', mesure: '' });
  }

  removeRisk(index: number) {
    this.pdp.risques_interferents.splice(index, 1);
  }

  async openSignatureClient() {
    const modal = await this.modalCtrl.create({
      component: SignatureModalComponent,
      componentProps: {
        chantierId: this.chantierId,
        type: 'generic' // On demande juste l'URL
      }
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm' && data) {
      this.pdp.signature_eu = data; // data contient l'URL Cloudinary
      this.presentToast('Signature Client enregistrée ✍️', 'success');
    }
  }

  // --- SAUVEGARDE ---
  async save() {
    const load = await this.loadingCtrl.create({ message: 'Enregistrement...' });
    await load.present();

    this.api.createPdp(this.pdp).subscribe({
      next: (res) => {
        this.pdp = res; // Mise à jour avec l'ID créé
        this.isExisting = true;
        load.dismiss();
        this.presentToast('Plan de Prévention sauvegardé ✅', 'success');
      },
      error: (err) => {
        console.error(err);
        load.dismiss();
        this.presentToast('Erreur lors de la sauvegarde', 'danger');
      }
    });
  }

  // --- ENVOI EMAIL ---
  async sendEmail() {
    if (!this.pdp.id) {
        this.presentToast("Veuillez d'abord enregistrer le document.", "warning");
        return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Envoyer par Email',
      message: 'Saisissez l\'adresse du destinataire (Client).',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'client@exemple.com',
          value: '' 
        }
      ],
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Envoyer',
          handler: (data) => {
            if (data.email) {
              this.processSendEmail(data.email);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async processSendEmail(email: string) {
    const load = await this.loadingCtrl.create({ message: 'Envoi en cours...' });
    await load.present();

    this.api.sendPdpEmail(this.pdp.id!, email).subscribe({
      next: () => {
        load.dismiss();
        this.presentToast('Email envoyé avec succès ! 📧', 'success');
      },
      error: () => {
        load.dismiss();
        this.presentToast('Erreur lors de l\'envoi (Vérifiez config SMTP)', 'danger');
      }
    });
  }

  // --- TÉLÉCHARGEMENT PDF ---
  // Rendu optionnel : si pas d'ID passé, on prend celui du PdP courant
  downloadPdf(pdpId?: number) {
    const targetId = pdpId || this.pdp.id;
    
    if (!targetId) {
        this.presentToast("Document non enregistré.", "warning");
        return;
    }

    this.presentToast('Ouverture du PDF...', 'primary');

    // 1. Récupérer le token d'authentification
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');

    if (!token) {
      this.presentToast('Erreur : Vous n\'êtes pas connecté', 'danger');
      return;
    }

    // 2. Construire l'URL avec le token en paramètre
    const url = `${this.api.apiUrl}/plans-prevention/${targetId}/pdf?token=${token}`;

    // 3. Ouvrir dans le navigateur système
    window.open(url, '_system');
  }

  // 👇 CORRECTION : Ajout du paramètre 'color' (optionnel avec valeur par défaut)
  async presentToast(msg: string, color: string = 'dark') {
    const t = await this.toastCtrl.create({ 
        message: msg, 
        duration: 2000, 
        position: 'bottom',
        color: color // Utilisation de la couleur passée
    });
    t.present();
  }
}