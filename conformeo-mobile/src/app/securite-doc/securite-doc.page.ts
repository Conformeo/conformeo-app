import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, LoadingController, ToastController, AlertController } from '@ionic/angular';
import { ApiService } from '../services/api';
import { addIcons } from 'ionicons';
import { shieldCheckmarkOutline, documentTextOutline, downloadOutline } from 'ionicons/icons';

@Component({
  selector: 'app-securite-doc',
  templateUrl: './securite-doc.page.html',
  styleUrls: ['./securite-doc.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class SecuriteDocPage implements OnInit {

  constructor(
    private api: ApiService,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController
  ) {
    addIcons({ shieldCheckmarkOutline, documentTextOutline, downloadOutline });
  }

  ngOnInit() { }

  async downloadDUERP() {
    const loading = await this.loadingCtrl.create({
      message: 'Récupération du Document Unique...',
      spinner: 'crescent'
    });
    await loading.present();

    this.api.downloadPublicDuerp().subscribe({
      next: (blob) => {
        loading.dismiss();
        
        // Création du lien de téléchargement invisible
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DUERP_Entreprise_${new Date().getFullYear()}.pdf`;
        document.body.appendChild(a);
        a.click();
        
        // Nettoyage
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      },
      error: async (err) => {
        loading.dismiss();
        
        // Gestion des erreurs (ex: pas de DUERP créé par le patron)
        let msg = "Une erreur est survenue lors du téléchargement.";
        if (err.status === 404) {
          msg = "L'employeur n'a pas encore mis en ligne de Document Unique pour cette année.";
        }

        const alert = await this.alertCtrl.create({
          header: 'Document non disponible',
          message: msg,
          buttons: ['Compris'],
          cssClass: 'custom-alert'
        });
        await alert.present();
      }
    });
  }
}