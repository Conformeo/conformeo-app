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
      console.log('🔴 LOGIN STARTED');
      
      if (!this.loadingCtrl) {
        console.error('❌ LoadingController is NULL');
        return;
      }
      
      console.log('🔴 ABOUT TO CREATE LOADING');
      
      // Timeout de sécurité
      const loadingPromise = this.loadingCtrl.create({ message: 'Connexion...' });
      const timeoutPromise = new Promise<any>((resolve) => {
        setTimeout(() => {
          console.error('❌ LoadingController.create() TIMEOUT');
          resolve(null);
        }, 3000);
      });
      
      const loading = await Promise.race([loadingPromise, timeoutPromise]);
      console.log('🔴 LOADING RESULT:', loading);
      
      if (loading) {
        await loading.present();
        console.log('🔴 LOADING PRESENTED');
      } else {
        console.warn('⚠️ Loading is null, skipping loading UI');
      }

      console.log('🔴 ABOUT TO CALL API.LOGIN');
      
      this.api.login(this.credentials).subscribe({
        next: () => {
          console.log('🟢 LOGIN SUCCESS');
          if (loading) loading.dismiss();
          this.presentToast('Connexion réussie', 'success');
          this.navCtrl.navigateRoot('/dashboard');
        },
        error: (err) => {
          console.log('🔴 LOGIN ERROR');
          console.error("Status:", err.status);
          console.error("Message:", err.message);
          
          if (loading) loading.dismiss();
          let message = `Erreur ${err.status}: ${err.message || 'Inconnue'}`;
          console.log(message); 
        }
      });
      
    } catch (error) {
      console.error('🔴 CATCH ERROR:', error);
    }
  }



  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top' });
    t.present();
  }
}
