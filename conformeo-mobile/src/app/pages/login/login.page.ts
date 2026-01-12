import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, LoadingController, ToastController } from '@ionic/angular';
import { ApiService } from 'src/app/services/api';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class LoginPage {
  credentials = { email: '', password: '' };

  constructor(
    private api: ApiService, 
    private navCtrl: NavController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {}

  async login() {
    console.log('ApiService instance', this.api);
    console.log('LOGIN CALL', this.credentials);

    const loading = await this.loadingCtrl.create({ message: 'Connexion...' });
    await loading.present();

    // 👇 AJOUTEZ CETTE LIGNE TEMPORAIRE
    alert("1. Le bouton fonctionne !"); 
    
    console.log("2. Démarrage connexion...");
    this.api.login(this.credentials).subscribe({
      next: () => {
        loading.dismiss();
        this.presentToast('Connexion réussie', 'success');
        // On force la navigation
        this.navCtrl.navigateRoot('/dashboard');
      },
     error: (err) => {
        loading.dismiss();
        console.error("❌ DEBUG ERREUR:", err);

        let message = 'Erreur inconnue';
        
        // ANALYSE DU CODE D'ERREUR
        if (err.status === 0) {
          message = '⚠️ ERREUR RÉSEAU (0) : Le serveur Render dort ou le CORS bloque.';
        } else if (err.status === 422) {
          message = '⚠️ ERREUR 422 (Format) : Le code Vercel est OBSOLÈTE (envoie du JSON).';
        } else if (err.status === 401) {
          message = '❌ ERREUR 401 (Auth) : Mot de passe refusé par le serveur.';
        } else if (err.status === 500) {
          message = '🔥 ERREUR 500 : Le serveur Python a planté.';
        } else {
          message = `Erreur ${err.status} : ${err.error ? JSON.stringify(err.error) : err.message}`;
        }

        // On affiche l'alerte précise à l'écran
        alert(message); 
      }
    });
  }

  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top' });
    t.present();
  }
}