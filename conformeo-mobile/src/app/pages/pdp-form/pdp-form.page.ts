import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, 
  IonList, IonListHeader, IonItem, IonInput, IonLabel, IonTextarea, 
  IonButton, IonIcon, IonDatetime, IonDatetimeButton, IonModal, 
  IonSelect, IonSelectOption, LoadingController, ToastController 
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, PlanPrevention } from '../../services/api'
import { addIcons } from 'ionicons';
import { add, trash, save, download } from 'ionicons/icons';

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
    private toastCtrl: ToastController
  ) {
    addIcons({ add, trash, save, download });
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
        
        // Sécuriser les champs JSON s'ils sont null
        if (!this.pdp.risques_interferents) this.pdp.risques_interferents = [];
        if (!this.pdp.consignes_securite) this.pdp.consignes_securite = {};
      } else {
        // Pré-remplissage intelligent
        this.api.getChantiers().subscribe(chantiers => { // Optimisation possible : getChantier(id)
            const c = chantiers.find(x => x.id === this.chantierId);
            if(c) {
                this.pdp.entreprise_utilisatrice = c.client; // Le client est souvent l'EU
                // On pourrait aussi pré-remplir "entreprise_exterieure" avec le nom de notre boite
            }
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

  // --- SAUVEGARDE ---
  async save() {
    const load = await this.loadingCtrl.create({ message: 'Enregistrement...' });
    await load.present();

    this.api.createPdp(this.pdp).subscribe({
      next: (res) => {
        this.pdp = res; // Mise à jour avec l'ID créé
        this.isExisting = true;
        load.dismiss();
        this.presentToast('Plan de Prévention sauvegardé ✅');
      },
      error: (err) => {
        console.error(err);
        load.dismiss();
        this.presentToast('Erreur lors de la sauvegarde');
      }
    });
  }

  downloadPdf() {
    if (!this.pdp.id) return;
    const url = this.api.getPdpPdfUrl(this.pdp.id);
    window.open(url, '_system');
  }

  async presentToast(msg: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, position: 'bottom' });
    t.present();
  }
}