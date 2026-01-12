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
    console.log('🔴 LOGIN STARTED - Before anything');
    
    const loading = await this.loadingCtrl.create({ message: 'Connexion...' });
    await loading.present();

    alert("1. Le bouton fonctionne !"); 
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
        console.error("❌ ERREUR:", err);
        console.error("Status:", err.status);
        console.error("Message:", err.message);
        
        loading.dismiss();
        let message = `Erreur ${err.status}: ${err.message || err.error?.detail || 'Inconnue'}`;
        alert(message); 
      }
    });
  }



  async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top' });
    t.present();
  }
}