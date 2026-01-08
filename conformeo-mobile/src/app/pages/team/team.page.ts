import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController, LoadingController } from '@ionic/angular'; 
import { addIcons } from 'ionicons';
import { add, person, trash, mail, key, business, create } from 'ionicons/icons';
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
  isEditing = false; // Pour savoir si on modifie ou crée
  selectedUserId: number | null = null;

  // Modèle du formulaire
  userData = { nom: '', email: '', password: '', role: 'Conducteur' };

  constructor(
    public api: ApiService, 
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {
    addIcons({ add, person, trash, mail, key, business, create });
  }

  ngOnInit() {
    this.api.getMe().subscribe(u => this.currentUserEmail = u.email);
  }

  ionViewWillEnter() {
    this.loadTeam();
  }

  loadTeam() {
    this.api.getTeam().subscribe({
      next: (data) => this.users = data,
      error: (err) => console.error("Erreur chargement équipe", err)
    });
  }

  // --- OUVERTURE MODALE ---
  
  openAddModal() {
    this.isEditing = false;
    this.userData = { nom: '', email: '', password: '', role: 'Conducteur' };
    this.isModalOpen = true;
  }

  openEditModal(user: any) {
    this.isEditing = true;
    this.selectedUserId = user.id;
    // On copie les données existantes (sans le mot de passe bien sûr)
    this.userData = { 
      nom: user.nom || '', 
      email: user.email, 
      role: user.role, 
      password: '' // On laisse vide, si rempli = changement de MDP
    };
    this.isModalOpen = true;
  }

  // --- SAUVEGARDE ---

  async saveUser() {
    if (!this.userData.email || !this.userData.nom) {
      this.presentToast('Nom et Email obligatoires', 'warning');
      return;
    }
    // Si création, mot de passe obligatoire
    if (!this.isEditing && !this.userData.password) {
      this.presentToast('Mot de passe obligatoire pour la création', 'warning');
      return;
    }

    const load = await this.loadingCtrl.create({ message: 'Sauvegarde...' });
    await load.present();

    if (this.isEditing && this.selectedUserId) {
      // MODE MODIFICATION
      this.api.updateTeamMember(this.selectedUserId, this.userData).subscribe({
        next: () => {
          load.dismiss();
          this.presentToast('Utilisateur modifié ! ✅', 'success');
          this.isModalOpen = false;
          this.loadTeam();
        },
        error: (err) => {
          load.dismiss();
          this.presentToast('Erreur modification', 'danger');
        }
      });
    } else {
      // MODE CRÉATION
      this.api.inviteMember(this.userData).subscribe({
        next: () => {
          load.dismiss();
          this.presentToast('Invitation envoyée ! 📩', 'success');
          this.isModalOpen = false;
          this.loadTeam();
        },
        error: (err) => {
          load.dismiss();
          this.presentToast(err.error?.detail || 'Erreur création', 'danger');
        }
      });
    }
  }

  // --- SUPPRESSION ---
  
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