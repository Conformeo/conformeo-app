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
    
    // Skip le loading UI qui timeout - on l'affichera pas
    console.log('🔴 ABOUT TO CALL API.LOGIN');
    
    this.api.login(this.credentials).subscribe({
      next: () => {
        console.log('🟢 LOGIN SUCCESS');
        this.presentToast('Connexion réussie', 'success');
        this.navCtrl.navigateRoot('/dashboard');
      },
      error: (err) => {
        console.log('🔴 LOGIN ERROR');
        console.error("Status:", err.status);
        
        let message = `Erreur ${err.status}: ${err.message || 'Inconnue'}`;
        this.presentToast(message, 'danger');
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
