import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular'; 
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent, 
  IonList, IonItem, IonLabel, IonNote, IonFab, IonFabButton, IonIcon, 
  IonBadge, IonAvatar, AlertController, ToastController, LoadingController,
  IonItemSliding, IonItemOptions, IonItemOption, IonModal, IonSelect, IonSelectOption,
  IonInput 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, person, shieldCheckmark, trash, personAdd, mail, key, business } from 'ionicons/icons';
import { ApiService } from '../../services/api';

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

  users: any[] = []; 
  currentUserEmail: string = '';
  
  // Pour la Modale d'ajout
  isModalOpen = false;
  newUser = { nom: '', email: '', password: '', role: 'Conducteur' };

  constructor(
    public api: ApiService, 
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
    this.api.http.get<any[]>(`${this.api.apiUrl}/team`).subscribe(data => {
      this.users = data;
    });
  }

  // --- 1. DEMANDE DE CONFIRMATION ---
  async confirmSave() {
    // Validation basique
    if (!this.newUser.email || !this.newUser.password || !this.newUser.nom) {
      this.presentToast('Veuillez remplir tous les champs', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Enregistrer le membre',
      message: 'Souhaitez-vous envoyer une notification d\'invitation à cette personne ?',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Non, juste enregistrer',
          handler: () => this.processSave(false) // false = on n'envoie pas d'invit (simulation)
        },
        {
          text: 'Oui, envoyer',
          handler: () => this.processSave(true) // true = on confirme l'envoi
        }
      ]
    });
    await alert.present();
  }

  // --- 2. EXECUTION API ---
  async processSave(sendInvite: boolean) {
    const load = await this.loadingCtrl.create({ message: 'Création en cours...' });
    await load.present();

    this.api.http.post(`${this.api.apiUrl}/team/invite`, this.newUser).subscribe({
      next: () => {
        load.dismiss();
        
        // Feedback visuel adapté au choix
        if (sendInvite) {
          this.presentToast('Membre créé et invitation envoyée ! 📩', 'success');
        } else {
          this.presentToast('Membre enregistré avec succès. ✅', 'medium');
        }

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
    const name = user.nom || user.email;
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  async presentToast(message: string, color: string = 'primary') {
    const t = await this.toastCtrl.create({ message, duration: 2000, color });
    t.present();
  }
}