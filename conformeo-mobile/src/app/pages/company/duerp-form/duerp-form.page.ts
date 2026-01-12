import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, NavController } from '@ionic/angular';
import { ApiService } from 'src/app/services/api'; // Assurez-vous que c'est .service si nécessaire
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
          this.addLine(); // ✅ Renommé pour matcher le HTML
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error("Erreur chargement DUERP", err);
        if(err.status === 401) this.presentToast('Session expirée', 'warning');
        
        this.lignes = [];
        this.addLine(); // ✅ Renommé pour matcher le HTML
        this.isLoading = false;
      }
    });
  }

  // 👇 RENOMMÉ : addRow -> addLine (pour correspondre au HTML)
  addLine() {
    this.lignes.push({ 
      tache: '', 
      risque: '', 
      gravite: 1, 
      mesures_realisees: '', 
      mesures_a_realiser: '' 
    });
  }

  // 👇 RENOMMÉ : removeRow -> removeLine (pour correspondre au HTML et corriger l'erreur)
  removeLine(index: number) {
    this.lignes.splice(index, 1);
  }

  save() {
    this.isLoading = true;
    
    const payload = { 
      annee: this.annee, 
      lignes: this.lignes 
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

  downloadPdf() {
    this.presentToast('Génération du PDF en cours...', 'primary');
    
    this.api.downloadDuerpPdf(this.annee).subscribe({
      next: (blob: any) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `DUERP_${this.annee}.pdf`;
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        this.presentToast('PDF téléchargé ! 📄', 'success');
      },
      error: (err) => {
        console.error("Erreur PDF:", err);
        this.presentToast('Impossible de générer le PDF', 'danger');
      }
    });
  }

  goBack() {
    this.navCtrl.back();
  }

  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 3000, color });
    t.present();
  }
}