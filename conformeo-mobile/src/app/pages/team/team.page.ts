import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController, LoadingController } from '@ionic/angular'; 
import { addIcons } from 'ionicons';
import { add, person, shieldCheckmark, trash, personAdd, mail, key, business } from 'ionicons/icons';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-team',
  templateUrl: './team.page.html',
  styleUrls: ['./team.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class TeamPage implements OnInit {

  users: any[] = []; 
  currentUserEmail: string = '';
  
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
    // 👇 UTILISATION DE LA MÉTHODE SÉCURISÉE DU SERVICE
    this.api.getTeam().subscribe({
      next: (data) => this.users = data,
      error: (err) => console.error("Erreur chargement équipe", err)
    });
  }

  async confirmSave() {
    if (!this.newUser.email || !this.newUser.password || !this.newUser.nom) {
      this.presentToast('Veuillez remplir tous les champs', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Enregistrer le membre',
      message: 'Souhaitez-vous envoyer une notification d\'invitation ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Non, juste enregistrer', handler: () => this.processSave(false) },
        { text: 'Oui, envoyer', handler: () => this.processSave(true) }
      ]
    });
    await alert.present();
  }

  async processSave(sendInvite: boolean) {
    const load = await this.loadingCtrl.create({ message: 'Création en cours...' });
    await load.present();

    // 👇 APPEL SÉCURISÉ
    this.api.inviteMember(this.newUser).subscribe({
      next: () => {
        load.dismiss();
        this.presentToast(sendInvite ? 'Invité et notifié ! 📩' : 'Enregistré avec succès. ✅', 'success');
        this.isModalOpen = false;
        this.newUser = { nom: '', email: '', password: '', role: 'Conducteur' };
        this.loadTeam();
      },
      error: (err) => {
        load.dismiss();
        // Gestion propre de l'erreur (Email déjà pris, etc.)
        const msg = err.error?.detail || 'Erreur lors de l\'ajout';
        this.presentToast(msg, 'danger');
      }
    });
  }

  async deleteUser(user: any) {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer ?',
      message: `Retirer ${user.nom || user.email} de l'équipe ?`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { 
          text: 'Supprimer', 
          role: 'destructive',
          handler: () => {
            // 👇 APPEL SÉCURISÉ
            this.api.deleteMember(user.id).subscribe({
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

  getInitials(user: any) {
    const name = user.nom || user.email;
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  async presentToast(message: string, color: string = 'primary') {
    const t = await this.toastCtrl.create({ message, duration: 2000, color });
    t.present();
  }
}