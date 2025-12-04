import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, 
  IonList, IonItem, IonLabel, IonNote, IonIcon, IonSegment, IonSegmentButton,
  IonBackButton, NavController, AlertController
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
  
  // On initialise avec la première catégorie exacte
  templateType = 'ADMINISTRATIF'; 
  
  // Liste des onglets (pour le HTML)
  categories = [
    'ADMINISTRATIF', 'EPI', 'CHUTES & ACCÈS', 'ÉLECTRICITÉ', 
    'LEVAGE & ENGINS', 'OUTILLAGE', 'HYGIÈNE', 'ENVIRONNEMENT'
  ];

  // Données des questions (Clés en MAJUSCULES pour matcher)
  templates: any = {
    'ADMINISTRATIF': [
      { q: "Panneau de chantier affiché ?", status: null },
      { q: "Registre de sécurité disponible ?", status: null },
      { q: "PPSPS à jour et consultable ?", status: null },
      { q: "Zones de stockage définies ?", status: null }
    ],
    'EPI': [
      { q: "Casque de sécurité porté ?", status: null },
      { q: "Chaussures de sécurité portées ?", status: null },
      { q: "Gilets haute-visibilité portés ?", status: null },
      { q: "Protections auditives/oculaires ?", status: null }
    ],
    'CHUTES & ACCÈS': [
      { q: "Garde-corps conformes ?", status: null },
      { q: "Trémies et ouvertures protégées ?", status: null },
      { q: "Échelles attachées et bon état ?", status: null },
      { q: "Échafaudages vérifiés ?", status: null },
      { q: "Zones de circulation dégagées ?", status: null }
    ],
    'ÉLECTRICITÉ': [
      { q: "Coffrets fermés à clé ?", status: null },
      { q: "Câbles en bon état ?", status: null },
      { q: "Câbles relevés (pas au sol) ?", status: null },
      { q: "Prises conformes ?", status: null }
    ],
    'LEVAGE & ENGINS': [
      { q: "VGP engins à jour ?", status: null },
      { q: "CACES conducteurs valides ?", status: null },
      { q: "Élingues conformes ?", status: null },
      { q: "Zone de manœuvre balisée ?", status: null }
    ],
    'OUTILLAGE': [
      { q: "Outils en bon état ?", status: null },
      { q: "Carters sur meuleuses ?", status: null },
      { q: "Rallonges déroulées ?", status: null }
    ],
    'HYGIÈNE': [
      { q: "Sanitaires propres ?", status: null },
      { q: "Réfectoire propre ?", status: null },
      { q: "Eau potable disponible ?", status: null },
      { q: "Trousse secours complète ?", status: null }
    ],
    'ENVIRONNEMENT': [
      { q: "Tri des déchets respecté ?", status: null },
      { q: "Pas de stockage sauvage ?", status: null },
      { q: "Kit anti-pollution présent ?", status: null },
      { q: "Pas de fuite produits ?", status: null }
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
    
    // Chargement initial
    this.loadTemplate('ADMINISTRATIF');
  }

  loadTemplate(type: string) {
    this.templateType = type;
    // Si on a déjà répondu, on garde les réponses, sinon on charge le template vierge
    // (Ici on simplifie : on recharge le template vierge à chaque changement d'onglet pour l'instant)
    // Pour garder les réponses entre onglets, il faudrait un objet global 'allResponses'.
    
    // Pour ce fix rapide : on charge les questions
    if (!this.templates[type]) {
        console.error("Template introuvable pour :", type);
        this.currentQuestions = [];
    } else {
        this.currentQuestions = this.templates[type]; 
    }
  }

  setStatus(index: number, status: string) {
    this.currentQuestions[index].status = status;
  }

  async save() {
    // Attention : ici on ne sauvegarde que l'onglet actif. 
    // Pour une V2, il faudra fusionner tous les onglets.
    
    const inspection: Inspection = {
      titre: `Audit ${this.templateType}`,
      type: this.templateType,
      chantier_id: this.chantierId,
      createur: 'Moi',
      data: this.currentQuestions
    };

    this.api.createInspection(inspection).subscribe({
      next: () => {
        alert("Audit enregistré !");
        this.api.needsRefresh = true; // Pour rafraîchir la liste chantier
        this.navCtrl.back();
      },
      error: (e) => {
          console.error(e);
          alert("Erreur lors de la sauvegarde.");
      }
    });
  }
}