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
  ) {
    console.log('🔴 LoginPage CONSTRUCTOR');
    console.log('LoadingController:', this.loadingCtrl);
    console.log('ToastController:', this.toastCtrl);
  }


  async login() {
    try {
      console.log('🔴 LOGIN STARTED - Before anything');
      
      console.log('this.loadingCtrl type:', typeof this.loadingCtrl);
      console.log('this.loadingCtrl is:', this.loadingCtrl);
      
      if (!this.loadingCtrl) {
        console.error('❌ LoadingController is NULL or UNDEFINED');
        console.log('Erreur critique: LoadingController not injected!');
        return;
      }
      
      console.log('🔴 ABOUT TO CREATE LOADING');
      const loading = await this.loadingCtrl.create({ message: 'Connexion...' });
      console.log('🔴 LOADING CREATED');
      
      await loading.present();
      console.log('🔴 LOADING PRESENTED');

      console.log("1. Le bouton fonctionne !"); 
      console.log("2. Démarrage connexion...");

      console.log('🔴 ABOUT TO CALL API.LOGIN');
      
      this.api.login(this.credentials).subscribe({
        next: () => {
          console.log('🟢 LOGIN SUCCESS');
          loading.dismiss();
          this.presentToast('Connexion réussie', 'success');
          this.navCtrl.navigateRoot('/dashboard');
        },
        error: (err) => {
          console.log('🔴 LOGIN ERROR - SUBSCRIBE ERROR HANDLER HIT');
          console.error("❌ ERREUR COMPLÈTE:", err);
          console.error("Status:", err.status);
          console.error("Message:", err.message);
          
          loading.dismiss();
          let message = `Erreur ${err.status}: ${err.message || err.error?.detail || 'Inconnue'}`;
          console.log(message); 
        }
      });
      
    } catch (error) {
      console.error('🔴 ERREUR CATCH:', error);
      console.log('Erreur critique: ' + (error as any).message);
    }
  }

  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top' });
    t.present();
  }
}
