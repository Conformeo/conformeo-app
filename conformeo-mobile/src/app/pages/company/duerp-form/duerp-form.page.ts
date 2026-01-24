import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, LoadingController } from '@ionic/angular';
import { ApiService } from '../../../services/api';
import { addIcons } from 'ionicons';
import { saveOutline, addCircle, trashOutline, downloadOutline, informationCircle } from 'ionicons/icons';

@Component({
  selector: 'app-duerp-form',
  templateUrl: './duerp-form.page.html',
  styleUrls: ['./duerp-form.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class DuerpFormPage implements OnInit {

  annee = new Date().getFullYear().toString();
  lignes: any[] = [];
  
  // Modèle pour une nouvelle ligne
  newLine = {
    unite_travail: 'Chantier Général',
    tache: '',
    risque: '',
    gravite: 2,
    mesures_realisees: '',
    mesures_a_realiser: '',
    statut: 'À FAIRE'
  };

  constructor(
    private api: ApiService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {
    addIcons({ saveOutline, addCircle, trashOutline, downloadOutline, informationCircle });
  }

  ngOnInit() {
    this.loadDuerp();
  }

  async loadDuerp() {
    const loading = await this.loadingCtrl.create({ message: 'Chargement...' });
    await loading.present();
    
    this.api.getDuerp(this.annee).subscribe({
      next: (data) => {
        // On s'assure que chaque ligne a un statut (pour les anciennes données)
        this.lignes = (data.lignes || []).map((l: any) => ({
          ...l,
          statut: l.statut || 'EN COURS'
        }));
        loading.dismiss();
      },
      error: () => {
        loading.dismiss();
        this.lignes = [];
      }
    });
  }

  addLine() {
    // Ajout à la liste locale
    this.lignes.push({ ...this.newLine });
    
    // Reset du formulaire (on garde l'unité de travail pour gagner du temps)
    this.newLine.tache = '';
    this.newLine.risque = '';
    this.newLine.mesures_realisees = '';
    this.newLine.mesures_a_realiser = '';
    this.newLine.statut = 'EN COURS';
    this.presentToast('Ligne ajoutée (Pensez à enregistrer)', 'medium');
  }

  removeLine(index: number) {
    this.lignes.splice(index, 1);
  }

  async save() {
    const loading = await this.loadingCtrl.create({ message: 'Sauvegarde du DUERP...' });
    await loading.present();

    const payload = {
      annee: parseInt(this.annee),
      lignes: this.lignes
    };

    this.api.saveDuerp(payload).subscribe({
      next: () => {
        loading.dismiss();
        this.presentToast('DUERP Enregistré avec succès ! ✅', 'success');
      },
      error: (err) => {
        loading.dismiss();
        console.error(err);
        this.presentToast('Erreur sauvegarde', 'danger');
      }
    });
  }

  async downloadPdf() {
    const loading = await this.loadingCtrl.create({ message: 'Génération PDF...' });
    await loading.present();

    this.api.downloadDuerpPdf(this.annee).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DUERP_${this.annee}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        loading.dismiss();
      },
      error: () => {
        loading.dismiss();
        this.presentToast('Erreur téléchargement PDF', 'danger');
      }
    });
  }

  getStatusColor(statut: string): string {
    switch(statut) {
      case 'FAIT': return 'var(--ion-color-success)'; // Vert
      case 'À FAIRE': return 'var(--ion-color-danger)'; // Rouge
      default: return 'var(--ion-color-danger)'; // Par défaut Rouge (gère les anciens 'EN COURS')
    }
  }

  // 👇 NOUVELLE FONCTION D'AUTOMATISATION
  autoUpdateStatus(ligne: any) {
    const aFaire = ligne.mesures_a_realiser ? ligne.mesures_a_realiser.trim() : '';
    const fait = ligne.mesures_realisees ? ligne.mesures_realisees.trim() : '';

    // Règle 1 : S'il reste des choses à faire, c'est "À FAIRE" (Rouge)
    if (aFaire.length > 0) {
      ligne.statut = 'À FAIRE';
    } 
    // Règle 2 : Si "À faire" est vide MAIS qu'il y a du "Fait", c'est "FAIT" (Vert)
    else if (fait.length > 0) {
      ligne.statut = 'FAIT';
    }
    // Sinon, on laisse par défaut (souvent À FAIRE)
  }

  async presentToast(msg: string, color: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, color: color, position: 'bottom' });
    t.present();
  }
}