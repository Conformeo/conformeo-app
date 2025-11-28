import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, 
  IonButtons, IonButton, IonIcon, IonBadge, IonFab, IonFabButton, 
  AlertController, IonRefresher, IonRefresherContent, IonBackButton
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, hammer, construct, home, swapHorizontal } from 'ionicons/icons';
import { ApiService, Materiel, Chantier } from 'src/app/services/api';

@Component({
  selector: 'app-materiel',
  templateUrl: './materiel.page.html',
  styleUrls: ['./materiel.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButtons, IonBackButton, IonIcon, IonBadge, IonFab, IonFabButton, IonRefresher, IonRefresherContent]
})
export class MaterielPage implements OnInit {
  materiels: Materiel[] = [];
  chantiers: Chantier[] = [];

  constructor(
    private api: ApiService,
    private alertCtrl: AlertController
  ) {
    addIcons({ add, hammer, construct, home, swapHorizontal });
  }

  ngOnInit() {
    this.loadData();
  }

  loadData(event?: any) {
    // 1. Charger le matériel
    this.api.getMateriels().subscribe(mats => {
      this.materiels = mats;
      if (event) event.target.complete();
    });

    // 2. Charger les chantiers (pour la liste de choix lors du transfert)
    this.api.getChantiers().subscribe(chantiers => {
      this.chantiers = chantiers;
    });
  }

  // --- ACTION 1 : Créer un outil ---
  async addMateriel() {
    const alert = await this.alertCtrl.create({
      header: 'Nouvel Outil',
      inputs: [
        { name: 'nom', type: 'text', placeholder: 'Nom (ex: Perceuse)' },
        { name: 'ref', type: 'text', placeholder: 'Référence (ex: HIL-01)' }
      ],
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Créer',
          handler: (data) => {
            if (data.nom) {
              this.api.createMateriel({ nom: data.nom, reference: data.ref, etat: 'Bon' }).subscribe(() => {
                this.loadData();
              });
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // --- ACTION 2 : Déplacer un outil ---
  async moveMateriel(mat: Materiel) {
    // On prépare les options : "Dépôt" + La liste des chantiers
    const inputs: any[] = [
      {
        type: 'radio',
        label: '🏠 Retour au Dépôt',
        value: null,
        checked: mat.chantier_id === null
      }
    ];

    this.chantiers.forEach(c => {
      inputs.push({
        type: 'radio',
        label: `🏗️ ${c.nom}`,
        value: c.id,
        checked: mat.chantier_id === c.id
      });
    });

    const alert = await this.alertCtrl.create({
      header: `Déplacer : ${mat.nom}`,
      inputs: inputs,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Valider Transfert',
          handler: (chantierId) => {
            // Appel API
            this.api.transferMateriel(mat.id!, chantierId).subscribe(() => {
              this.loadData(); // Rafraichir la liste
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // Helper pour trouver le nom du chantier
  getChantierName(id: number | null | undefined): string {
    if (!id) return 'Au Dépôt';
    const c = this.chantiers.find(x => x.id === id);
    return c ? c.nom : 'Inconnu';
  }
}