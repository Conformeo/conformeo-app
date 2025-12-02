import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonList, IonItem, IonLabel, IonNote, IonIcon, IonSegment, IonSegmentButton,
  NavController, AlertController, IonBackButton
} from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import { addIcons } from 'ionicons';
import { checkmarkCircle, closeCircle, ban, save } from 'ionicons/icons';
import { ApiService, Inspection } from 'src/app/services/api';

@Component({
  selector: 'app-qhse-form',
  templateUrl: './qhse-form.page.html',
  styleUrls: ['./qhse-form.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonList, IonItem, IonLabel, IonNote, IonIcon, IonSegment, IonSegmentButton, IonBackButton]
})
export class QhseFormPage implements OnInit {
  chantierId!: number;
  templateType = 'Securite'; // Par défaut
  
  // Les modèles de questions
  templates: any = {
    'Securite': [
      { q: "Port des EPI (Casque, Chaussures)", status: null },
      { q: "Balisage de la zone respecté", status: null },
      { q: "Échafaudages conformes", status: null },
      { q: "Coffret électrique fermé", status: null }
    ],
    'Environnement': [
      { q: "Tri des déchets effectué", status: null },
      { q: "Pas de fuite produits chimiques", status: null },
      { q: "Propreté générale du chantier", status: null }
    ]
  };

  currentQuestions: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private navCtrl: NavController,
    private alertCtrl: AlertController
  ) {
    addIcons({ checkmarkCircle, closeCircle, ban, save });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.chantierId = +id;
    this.loadTemplate('Securite');
  }

  loadTemplate(type: string) {
    this.templateType = type;
    // On copie le template pour ne pas modifier l'original en mémoire
    this.currentQuestions = JSON.parse(JSON.stringify(this.templates[type] || []));
  }

  setStatus(index: number, status: string) {
    this.currentQuestions[index].status = status;
  }

  async save() {
    // Vérification que tout est rempli ? (Optionnel)
    const incomplete = this.currentQuestions.find(i => i.status === null);
    if (incomplete) {
      const alert = await this.alertCtrl.create({
        header: 'Incomplet',
        message: 'Veuillez répondre à toutes les questions.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const inspection: Inspection = {
      titre: `Audit ${this.templateType}`,
      type: this.templateType,
      chantier_id: this.chantierId,
      createur: 'Moi', // À remplacer par le user connecté plus tard
      data: this.currentQuestions
    };

    this.api.createInspection(inspection).subscribe(() => {
      this.navCtrl.back();
    });
  }
}