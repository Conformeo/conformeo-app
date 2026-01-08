import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular'; 
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent, 
  IonList, IonItem, IonLabel, IonNote, IonFab, IonFabButton, IonIcon, 
  IonBadge, IonAvatar, AlertController, ToastController, LoadingController,
  IonItemSliding, IonItemOptions, IonItemOption, IonModal, IonSelect, IonSelectOption,
  IonInput // Ajouts nécessaires
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, person, shieldCheckmark, trash, personAdd, mail, key, business } from 'ionicons/icons';
import { ApiService, User } from '../../services/api';

@Component({
  selector: 'app-team',
  templateUrl: './team.page.html',
  styleUrls: ['./team.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonicModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent,
    IonList, IonItem, IonLabel, IonNote, IonFab, IonFabButton, IonIcon,
    IonBadge, IonAvatar, IonItemSliding, IonItemOptions, IonItemOption,
    IonModal, IonSelect, IonSelectOption, IonInput
  ]
})
export class TeamPage implements OnInit {

  users: any[] = []; // On utilise any pour flexibilité ou l'interface User
  currentUserEmail: string = '';
  
  // Pour la Modale d'ajout
  isModalOpen = false;
  newUser = { nom: '', email: '', password: '', role: 'Conducteur' };

  constructor(
    public api: ApiService, // Public pour l'utiliser dans le HTML si besoin
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {
    addIcons({ add, person, shieldCheckmark, trash, personAdd, mail, key, business });
  }

  ngOnInit() {
    this.api.getMe().subscribe(u => this.currentUserEmail = u.email);
  }

  ionViewWillEnter() {
    this.loadTeam();
  }

  loadTeam() {
    // Assurez-vous que votre ApiService a bien la méthode getTeam() -> GET /team
    this.api.http.get<any[]>(`${this.api.apiUrl}/team`).subscribe(data => {
      this.users = data;
    });
  }

  // --- AJOUTER UN MEMBRE ---
  async saveUser() {
    if (!this.newUser.email || !this.newUser.password || !this.newUser.nom) {
      this.presentToast('Veuillez remplir tous les champs', 'warning');
      return;
    }

    const load = await this.loadingCtrl.create({ message: 'Envoi de l\'invitation...' });
    await load.present();

    // On utilise la route POST /team/invite du backend
    this.api.http.post(`${this.api.apiUrl}/team/invite`, this.newUser).subscribe({
      next: () => {
        load.dismiss();
        this.presentToast('Invitation envoyée ! 🎉', 'success');
        this.isModalOpen = false;
        this.newUser = { nom: '', email: '', password: '', role: 'Conducteur' }; // Reset
        this.loadTeam(); // Rafraîchir la liste
      },
      error: (err) => {
        load.dismiss();
        this.presentToast(err.error.detail || 'Erreur lors de l\'ajout', 'danger');
      }
    });
  }

  // --- SUPPRIMER UN MEMBRE ---
  async deleteUser(user: any) {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer ?',
      message: `Voulez-vous retirer ${user.nom || user.email} de l'équipe ?`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { 
          text: 'Supprimer', 
          role: 'destructive',
          handler: () => {
            this.api.http.delete(`${this.api.apiUrl}/team/${user.id}`).subscribe({
              next: () => {
                this.users = this.users.filter(u => u.id !== user.id);
                this.presentToast('Membre supprimé', 'dark');
              },
              error: () => this.presentToast('Impossible de supprimer', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // Helpers
  getInitials(user: any) {
    // Priorité au Nom, sinon Email
    const name = user.nom || user.email;
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  async presentToast(message: string, color: string = 'primary') {
    const t = await this.toastCtrl.create({ message, duration: 2000, color });
    t.present();
  }
}