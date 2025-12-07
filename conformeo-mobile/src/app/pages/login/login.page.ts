import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController } from '@ionic/angular';
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

  constructor(private api: ApiService, private navCtrl: NavController) {}

  login() {
    this.api.login(this.credentials).subscribe({
      next: () => {
        this.navCtrl.navigateRoot('/dashboard'); // Ou /home
      },
      error: () => {
        alert("Email ou mot de passe incorrect");
      }
    });
  }
}