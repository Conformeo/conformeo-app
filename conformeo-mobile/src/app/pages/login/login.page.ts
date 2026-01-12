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

  alert("1. Le bouton fonctionne !"); 
  console.log("2. Démarrage connexion...");

  // 👇 DEBUG : Log ce qui est envoyé
  const body = new URLSearchParams();
  body.set('username', this.credentials.email);
  body.set('password', this.credentials.password);
  console.log('Body URLSearchParams:', body);
  console.log('Body string:', body.toString());  // ✅ C'EST BON (pas .entries())

  this.api.login(this.credentials).subscribe({
    next: () => {
      loading.dismiss();
      this.presentToast('Connexion réussie', 'success');
      this.navCtrl.navigateRoot('/dashboard');
    },
    error: (err) => {
      loading.dismiss();
      console.error("❌ DEBUG ERREUR COMPLET:", err);
      console.error("Status:", err.status);
      console.error("StatusText:", err.statusText);
      console.error("Error object:", err.error);

      let message = 'Erreur inconnue';
      if (err.status === 0) {
        message = '⚠️ ERREUR RÉSEAU (0) : Impossible de contacter le serveur.';
      } else if (err.status === 422) {
        message = '⚠️ ERREUR 422 (Format) : Le serveur refuse le format.';
      } else if (err.status === 401) {
        message = '❌ ERREUR 401 (Auth) : Identifiants incorrects.';
      } else if (err.status === 500) {
        message = '🔥 ERREUR 500 : Le serveur a crashé.';
      } else {
        message = `Erreur ${err.status} : ${err.error ? JSON.stringify(err.error) : err.message}`;
      }

      alert(message); 
    }
  });
}


  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top' });
    t.present();
  }
}