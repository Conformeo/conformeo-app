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
      this.presentToast('Veuillez remplir tous les champs', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Authentification...' });
    await loading.present();

    console.log("Tentative de connexion...", this.credentials);

    // 👇 CORRECTION ICI : On envoie l'objet 'this.credentials' en entier
    this.api.login(this.credentials).subscribe({
      next: (res: any) => {
        loading.dismiss();
        console.log("🔍 Réponse Serveur Login :", res);

        // --- SAUVEGARDE DU TOKEN (Partie importante à garder) ---
        const token = res.token || res.access_token || (res.data ? res.data.token : null);

        if (token) {
          console.log("✅ Token trouvé ! Sauvegarde...");
          
          localStorage.removeItem('token');
          localStorage.removeItem('access_token');

          localStorage.setItem('token', token);
          localStorage.setItem('access_token', token);

          this.presentToast('Connexion réussie', 'success');
          this.navCtrl.navigateRoot('/dashboard'); 
        } else {
          console.error("❌ ERREUR : Pas de token reçu !", res);
          this.presentToast('Erreur technique : Pas de jeton', 'danger');
        }
      },
      error: (err) => {
        loading.dismiss();
        console.error("❌ Échec connexion :", err);
        
        if (err.status === 401) {
          this.presentToast('Email ou mot de passe incorrect', 'danger');
        } else {
          this.presentToast('Impossible de joindre le serveur', 'warning');
        }
      }
    });
  }

  async presentToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 3000,
      color: color,
      position: 'top'
    });
    toast.present();
  }
}