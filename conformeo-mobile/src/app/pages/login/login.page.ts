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
    const loading = await this.loadingCtrl.create({ message: 'Connexion...' });
    await loading.present();

    this.api.login(this.credentials).subscribe({
      next: () => {
        loading.dismiss();
        this.presentToast('Connexion réussie', 'success');
        
        // Redirection vers le dashboard
        // Le token est déjà dans le localStorage grâce au tap() du service
        this.navCtrl.navigateRoot('/dashboard');
      },
      error: (err) => {
        loading.dismiss();
        console.error("Erreur Login:", err);
        if (err.status === 401 || err.status === 403) {
           this.presentToast('Identifiants incorrects', 'danger');
        } else {
           this.presentToast('Erreur serveur ou connexion', 'warning');
        }
      }
    });
  }

  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top' });
    t.present();
  }
}