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
    if (!this.credentials.email || !this.credentials.password) {
      this.presentToast('Veuillez remplir email et mot de passe', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Connexion...' });
    await loading.present();

    // On passe l'objet entier car votre ApiService attend un objet UserLogin
    this.api.login(this.credentials).subscribe({
      next: async (res: any) => {
        loading.dismiss();
        
        // 1. Analyse de la réponse
        // FastAPI renvoie souvent 'access_token', parfois 'token'
        const token = res.access_token || res.token;

        if (token) {
          console.log("🔑 Token reçu :", token.substring(0, 10) + "...");
          
          // 2. SAUVEGARDE SYNCHRONE IMMÉDIATE (Vital !)
          localStorage.setItem('token', token);
          localStorage.setItem('access_token', token);
          
          // 3. Mise à jour de la variable mémoire du service
          this.api.forceTokenRefresh(token);

          // 4. Redirection
          this.presentToast('Connexion réussie', 'success');
          this.navCtrl.navigateRoot('/dashboard'); 
        } else {
          console.error("❌ Pas de token dans la réponse :", res);
          this.presentToast('Erreur serveur : Token manquant', 'danger');
        }
      },
      error: (err) => {
        loading.dismiss();
        console.error("❌ Erreur Login :", err);
        if (err.status === 401 || err.status === 403) {
          this.presentToast('Email ou mot de passe incorrect', 'danger');
        } else {
          this.presentToast('Erreur de connexion serveur', 'warning');
        }
      }
    });
  }

  async presentToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message, duration: 3000, color, position: 'top'
    });
    toast.present();
  }
}