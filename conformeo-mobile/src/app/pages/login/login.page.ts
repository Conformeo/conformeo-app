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
  credentials = { email: 'admin@conformeo.com', password: 'admin' };

  constructor(
    private api: ApiService, 
    private navCtrl: NavController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {}

  async login() {
    console.log("🚀 Démarrage connexion (Mode FETCH)...");

    if (!this.credentials.email || !this.credentials.password) {
      this.presentToast('Remplissez les champs', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Connexion directe...' });
    await loading.present();

    // 1. Préparation des données (Format standard OAuth2)
    const body = new URLSearchParams();
    body.append('username', this.credentials.email);
    body.append('password', this.credentials.password);

    try {
      // 2. Appel "BRUT" via fetch (contourne le HttpClient Angular pour le test)
      const response = await fetch('https://conformeo-api.onrender.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: body
      });

      console.log("📡 Statut Réponse :", response.status);

      // 3. Traitement du résultat
      if (response.ok) {
        const data = await response.json();
        console.log("🔥 TOKEN REÇU VIA FETCH :", data);

        const token = data.access_token || data.token;
        
        // Sauvegarde manuelle
        localStorage.setItem('token', token);
        localStorage.setItem('access_token', token);
        
        // On informe le service API
        this.api.forceTokenRefresh(token);

        loading.dismiss();
        this.presentToast('Connexion Réussie !', 'success');
        this.navCtrl.navigateRoot('/dashboard');

      } else {
        // Erreur serveur (401, 500, etc.)
        const errorData = await response.text();
        console.error("❌ ERREUR FETCH :", errorData);
        loading.dismiss();
        this.presentToast(`Erreur ${response.status}: Identifiants incorrects ?`, 'danger');
      }

    } catch (error) {
      // Erreur réseau ou CORS
      loading.dismiss();
      console.error("☠️ CRASH RÉSEAU/CORS :", error);
      alert("Blocage Réseau ! Vérifiez que votre backend autorise bien les requêtes (CORS).");
    }
  }

  async presentToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message, duration: 4000, color, position: 'top'
    });
    toast.present();
  }
}