import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, NavController } from '@ionic/angular';
import { ApiService } from 'src/app/services/api';
import { addIcons } from 'ionicons';
import { add, trash, save, cloudDownload, arrowBack, documentText } from 'ionicons/icons';

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
  
  isLoading = false; 

  constructor(
    private api: ApiService,
    private toastCtrl: ToastController,
    private navCtrl: NavController
  ) {
    addIcons({ add, trash, save, cloudDownload, arrowBack, documentText });
  }

  ngOnInit() {
    this.loadDuerp();
  }

  loadDuerp() {
    this.isLoading = true;
    
    this.api.getDuerp(this.annee).subscribe({
      next: (data) => {
        if (data && data.lignes && data.lignes.length > 0) {
          this.lignes = data.lignes;
        } else {
          this.lignes = [];
          this.addLine();
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error("Erreur chargement DUERP", err);
        // On ne vide pas forcément la liste en cas d'erreur réseau, 
        // mais ici on initialise pour éviter un écran vide.
        this.lignes = [];
        this.addLine(); 
        this.isLoading = false;
      }
    });
  }

  addLine() {
    this.lignes.push({ 
      tache: '', 
      risque: '', 
      gravite: 1, 
      mesures_realisees: '', 
      mesures_a_realiser: '' 
    });
  }

  removeLine(index: number) {
    this.lignes.splice(index, 1);
  }

  save() {
    this.isLoading = true;
    
    // Conversion de gravite en int pour être sûr (l'input peut renvoyer une string)
    const lignesPropres = this.lignes.map(l => ({
        ...l,
        gravite: parseInt(l.gravite) || 1
    }));

    const payload = { 
      annee: parseInt(this.annee), 
      lignes: lignesPropres 
    };

    this.api.saveDuerp(payload).subscribe({
      next: () => {
        this.isLoading = false;
        this.presentToast('DUERP enregistré avec succès ! ✅', 'success');
      },
      error: (err) => {
        this.isLoading = false;
        console.error(err);
        this.presentToast('Erreur lors de la sauvegarde', 'danger');
      }
    });
  }

  // 👇 MODIFICATION MAJEURE ICI
  downloadPdf() {
    this.presentToast('Ouverture du PDF...', 'primary');
    
    // 1. On récupère le token stocké (le sésame)
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    
    if (!token) {
        this.presentToast('Erreur : Non connecté', 'danger');
        return;
    }

    // 2. On construit l'URL avec le token en paramètre (?token=...)
    const url = `${this.api.apiUrl}/companies/me/duerp/${this.annee}/pdf?token=${token}`;
    
    // 3. On ouvre ! 
    // '_system' force le navigateur du téléphone (Safari/Chrome) qui gère parfaitement les PDF
    window.open(url, '_system');
  }

  goBack() {
    this.navCtrl.back();
  }

  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 3000, color });
    t.present();
  }
}