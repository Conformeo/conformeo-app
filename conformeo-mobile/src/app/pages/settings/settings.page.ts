import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular'; // ou @ionic/angular/standalone selon votre version
import { ApiService } from '../../services/api'
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { mailOutline, lockClosedOutline, logOutOutline } from 'ionicons/icons';

@Component({
  selector: 'app-settings', // ou app-profil
  templateUrl: './settings.page.html', // ou profil.page.html
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class SettingsPage implements OnInit {

  user: any = null;
  data = {
    email: '',
    password: ''
  };

  constructor(
    private api: ApiService,
    private router: Router,
    private toastCtrl: ToastController
  ) {
    addIcons({ mailOutline, lockClosedOutline, logOutOutline });
  }

  ngOnInit() {
    // On récupère l'user connecté
    this.api.getMe().subscribe(u => {
      this.user = u;
      this.data.email = u.email;
    });
  }

  async updateProfile() {
    // Appel à la nouvelle route Backend
    this.api.updateUser(this.data).subscribe({
      next: (res) => {
        this.presentToast('Profil mis à jour ✅');
        this.data.password = ''; // On vide le champ mdp par sécurité
      },
      error: (err) => {
        this.presentToast('Erreur lors de la mise à jour');
      }
    });
  }

  logout() {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }

  // Petit helper pour les initiales (ex: michel@gmail.com -> M)
  getInitials(email: string) {
    if (!email) return '?';
    return email.charAt(0).toUpperCase();
  }

  async presentToast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2000 });
    t.present();
  }
}