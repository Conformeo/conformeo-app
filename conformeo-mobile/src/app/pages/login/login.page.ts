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
    console.log("🚀 Démarrage connexion...");

    if (!this.credentials.email || !this.credentials.password) {
      this.presentToast('Veuillez remplir email et mot de passe', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Interrogation serveur...' });
    await loading.present();

    // On appelle l'API
    this.api.login(this.credentials).subscribe({
      next: (res: any) => {
        loading.dismiss();
        
        // 👇 ZONE DE DÉBOGAGE (Regardez votre console après le clic)
        console.log("🔥 RÉPONSE BRUTE DU SERVEUR :", res);
        console.log("Type de réponse :", typeof res);

        // 1. Recherche du token (stratégie large)
        let token = null;
        
        if (res && res.access_token) token = res.access_token;
        else if (res && res.token) token = res.token;
        else if (res && res.data && res.data.token) token = res.data.token;
        
        // 2. Traitement
        if (token) {
          console.log("✅ Token trouvé :", token.substring(0, 15) + "...");
          
          // SAUVEGARDE FORCÉE (On n'attend pas le service)
          localStorage.setItem('token', token);
          localStorage.setItem('access_token', token); // Double sécurité
          
          // Force le service à le prendre en compte tout de suite
          this.api.forceTokenRefresh(token);

          this.presentToast('Connexion réussie !', 'success');
          
          // Petit délai pour être sûr que le stockage est écrit
          setTimeout(() => {
             this.navCtrl.navigateRoot('/dashboard');
          }, 500);

        } else {
          console.error("❌ ECHEC : Le serveur a répondu 200 OK mais sans token !", res);
          alert("Erreur technique : Le serveur a validé le mot de passe mais n'a pas renvoyé de jeton de connexion. Regardez la console.");
        }
      },
      error: (err) => {
        loading.dismiss();
        console.error("❌ ERREUR HTTP :", err);
        
        if (err.status === 401) {
          this.presentToast('Email ou mot de passe incorrect', 'danger');
        } else if (err.status === 0) {
          this.presentToast('Impossible de contacter le serveur (Vérifiez internet)', 'warning');
        } else {
          this.presentToast(`Erreur ${err.status}: ${err.statusText}`, 'danger');
        }
      }
    });
  }

  async presentToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message, duration: 4000, color, position: 'top'
    });
    toast.present();
  }
}