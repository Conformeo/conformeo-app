import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, LoadingController, ToastController } from '@ionic/angular';
import { ApiService } from 'src/app/services/api'; // Vérifiez que le chemin est correct

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class LoginPage {
  // L'objet contenant les infos de connexion
  credentials = { email: '', password: '' };

  constructor(
    private api: ApiService, 
    private navCtrl: NavController,
    private loadingCtrl: LoadingController, // Pour afficher "Connexion..."
    private toastCtrl: ToastController      // Pour les messages d'erreur
  ) {}

  async login() {
    // 1. Petite sécurité : champs vides
    if (!this.credentials.email || !this.credentials.password) {
      this.presentToast('Veuillez remplir tous les champs', 'warning');
      return;
    }

    // 2. Affichage du chargement
    const loading = await this.loadingCtrl.create({ message: 'Connexion en cours...' });
    await loading.present();

    // 3. Appel API
    // Note : Je passe 'this.credentials' (objet) ou 'email, password' selon votre ApiService. 
    // Si votre ApiService attend 2 arguments, mettez : this.api.login(this.credentials.email, this.credentials.password)
    this.api.login(this.credentials).subscribe({
      next: (res: any) => {
        loading.dismiss();

        // 👇👇 C'EST ICI LE FIX CRUCIAL 👇👇
        // On cherche le token dans la réponse (parfois 'token', parfois 'access_token')
        const tokenToSave = res.token || res.access_token;

        if (tokenToSave) {
          console.log("✅ Token récupéré et sauvegardé :", tokenToSave.substring(0, 10) + "...");
          
          // SAUVEGARDE EXPLICITE DANS LE TÉLÉPHONE
          localStorage.setItem('token', tokenToSave); 
          
          // Sécurité supplémentaire : on le met aussi dans 'access_token' au cas où
          localStorage.setItem('access_token', tokenToSave);
        } else {
          console.error("⚠️ Attention : Connexion réussie mais aucun token renvoyé par le serveur !", res);
        }
        // 👆👆 FIN DU FIX 👆👆

        // Redirection vers le tableau de bord
        this.navCtrl.navigateRoot('/dashboard');
      },
      error: (err) => {
        loading.dismiss();
        console.error("Erreur Login:", err);
        this.presentToast('Email ou mot de passe incorrect', 'danger');
      }
    });
  }

  // Petite fonction utilitaire pour afficher les messages
  async presentToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 3000,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }
}