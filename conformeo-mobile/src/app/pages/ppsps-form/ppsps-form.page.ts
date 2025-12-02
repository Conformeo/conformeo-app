import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, 
  IonList, IonItem, IonInput, IonLabel, IonListHeader, IonCheckbox, 
  IonButton, IonIcon, NavController, AlertController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { saveOutline, medicalOutline, timeOutline, peopleOutline } from 'ionicons/icons';
import { ApiService, PPSPS } from 'src/app/services/api';

@Component({
  selector: 'app-ppsps-form',
  templateUrl: './ppsps-form.page.html',
  styleUrls: ['./ppsps-form.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonList, IonItem, IonInput, IonLabel, IonListHeader, IonCheckbox, IonButton, IonIcon]
})
export class PpspsFormPage implements OnInit {
  chantierId!: number;

  // Données du formulaire
  formData = {
    maitre_oeuvre: '',
    coordonnateur_sps: '',
    hopital_proche: '',
    responsable_securite: '',
    nb_compagnons: 2,
    horaires: '08h00 - 17h00'
  };

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

  async save() {
    if (!this.formData.hopital_proche || !this.formData.responsable_securite) {
      const alert = await this.alertCtrl.create({
        header: 'Incomplet',
        message: 'Veuillez au moins indiquer les Urgences et le Responsable Sécurité.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    // On transforme le tableau de risques en objet JSON simple pour l'API
    // Ex: { chute: true, elec: false }
    const risquesJson: any = {};
    this.risques.forEach(r => risquesJson[r.key] = r.checked);

    const ppsps: PPSPS = {
      chantier_id: this.chantierId,
      ...this.formData,
      risques: risquesJson
    };

    this.api.createPPSPS(ppsps).subscribe({
      next: () => {
        alert("PPSPS créé avec succès !");
        this.navCtrl.back();
      },
      error: (err) => {
        console.error(err);
        alert("Erreur lors de la création.");
      }
    });
  }
}