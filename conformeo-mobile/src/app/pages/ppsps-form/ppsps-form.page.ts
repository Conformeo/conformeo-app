import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, 
  IonList, IonItem, IonInput, IonLabel, IonListHeader, IonCheckbox, 
  IonButton, IonIcon, NavController, AlertController, IonCard, IonCardContent,
  IonCardHeader, IonCardTitle, IonCardSubtitle, IonSegmentButton, IonSegment,
  IonSelectOption, IonSelect
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { saveOutline, medicalOutline, timeOutline, peopleOutline } from 'ionicons/icons';
import { ApiService, PPSPS } from 'src/app/services/api';

@Component({
  selector: 'app-ppsps-form',
  templateUrl: './ppsps-form.page.html',
  styleUrls: ['./ppsps-form.page.scss'],
  standalone: true,
  imports: [CommonModule, 
    FormsModule, 
    IonContent, 
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonButtons, 
    IonBackButton, 
    // IonList, 
    IonItem, 
    IonInput, 
    IonLabel, 
    IonListHeader, 
    // IonCheckbox, 
    IonButton, 
    IonIcon, 
    IonCard, 
    IonCardContent, 
    IonCardHeader, 
    IonCardTitle, 
    IonCardSubtitle, 
    IonSegmentButton, 
    IonSegment, 
    IonSelectOption, IonSelect]
})
export class PpspsFormPage implements OnInit {
  chantierId!: number;
  step = 'general'; // Onglet actif

  formData = {
    responsable_chantier: '',
    coordonnateur_sps: '',
    maitre_ouvrage: '',
    maitre_oeuvre: '',
    nb_compagnons: 2,
    horaires: '08h00 - 17h00',
    duree_travaux: ''
  };

  secoursData = {
    hopital: '',
    num_urgence: '15 / 18',
    trousse_loc: '',
    sst_noms: ''
  };

  installationsData = {
    type_base: '',
    eau: '',
    repas: ''
  };

  tachesData: any[] = []; // Liste des tâches ajoutées
  currentTache = { tache: '', risque: '', prevention: '' }; // Tâche en cours de saisie

  // Liste des risques (Doit correspondre aux clés du backend python)
  risques = [
    { key: 'chute', label: 'Travail en hauteur / Chutes', checked: false },
    { key: 'elec', label: 'Risques Électriques', checked: false },
    { key: 'levage', label: 'Appareils de Levage / Grue', checked: false },
    { key: 'produits', label: 'Produits Chimiques / Poussières', checked: false },
    { key: 'coactivite', label: 'Co-activité / Circulation engins', checked: false }
  ];

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private navCtrl: NavController,
    private alertCtrl: AlertController
  ) {
    addIcons({ saveOutline, medicalOutline, timeOutline, peopleOutline });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.chantierId = +id;
  }

  addTache() {
    if (this.currentTache.tache && this.currentTache.risque) {
      this.tachesData.push({ ...this.currentTache });
      this.currentTache = { tache: '', risque: '', prevention: '' }; // Reset
    }
  }

  removeTache(index: number) {
    this.tachesData.splice(index, 1);
  }

  async save() {
    const ppsps: any = { // Utilise 'any' ou met à jour l'interface PPSPS dans api.service.ts
      chantier_id: this.chantierId,
      ...this.formData,
      secours_data: this.secoursData,
      installations_data: this.installationsData,
      taches_data: this.tachesData,
      risques: {} // On garde vide pour compatibilité ancien champ
    };

    this.api.createPPSPS(ppsps).subscribe({
      next: () => {
        alert("PPSPS enregistré !");
        this.navCtrl.back();
      },
      error: () => alert("Erreur sauvegarde")
    });
  }
}