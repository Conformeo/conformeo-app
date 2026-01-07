import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent, 
  IonList, IonItem, IonLabel, IonNote, IonFab, IonFabButton, IonIcon, 
  IonBadge, IonAvatar, AlertController, ToastController, LoadingController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, person, shieldCheckmark } from 'ionicons/icons';
import { ApiService, User } from '../../services/api'

@Component({
  selector: 'app-team',
  templateUrl: './team.page.html',
  styleUrls: ['./team.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent,
    IonList, IonItem, IonLabel, IonNote, IonFab, IonFabButton, IonIcon,
    IonBadge, IonAvatar
  ]
})
export class TeamPage implements OnInit {

  users: User[] = [];
  currentUserEmail: string = '';

  constructor(
    private api: ApiService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {
    addIcons({ add, person, shieldCheckmark });
  }

  ngOnInit() {
    // On récupère l'info de l'user connecté pour le marquer dans la liste
    this.api.getMe().subscribe(u => this.currentUserEmail = u.email);
  }

  ionViewWillEnter() {
    this.loadTeam();
  }

  loadTeam() {
    this.api.getTeam().subscribe(data => {
      this.users = data;
    });
  }

  async addUser() {
    const alert = await this.alertCtrl.create({
      header: 'Nouveau Membre',
      subHeader: 'Inviter un collaborateur',
      inputs: [
        { name: 'email', type: 'email', placeholder: 'Email (ex: jean@btp.com)' },
        { name: 'password', type: 'text', placeholder: 'Mot de passe provisoire' },
        // On pourrait ajouter un select pour le rôle ici, mais AlertController est limité.
        // Par défaut on créera un 'user'.
      ],
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Créer',
          handler: (data) => {
            if (!data.email || !data.password) {
              this.presentToast('Champs manquants');
              return false;
            }
            this.createMember(data.email, data.password, 'user');
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async createMember(email: string, pass: string, role: string) {
    const load = await this.loadingCtrl.create({ message: 'Création...' });
    await load.present();

    this.api.addTeamMember({ email, password: pass, role }).subscribe({
      next: (u) => {
        this.users.push(u);
        load.dismiss();
        this.presentToast(`Utilisateur ${u.email} ajouté ! ✅`);
      },
      error: (err) => {
        load.dismiss();
        console.error(err);
        this.presentToast('Erreur : Email probablement déjà pris.');
      }
    });
  }

  // Helpers
  getInitials(email: string) {
    return email ? email.charAt(0).toUpperCase() : '?';
  }

  async presentToast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2000 });
    t.present();
  }
}