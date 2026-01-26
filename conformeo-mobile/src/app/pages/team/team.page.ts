import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController, LoadingController } from '@ionic/angular'; 
import { addIcons } from 'ionicons';
import { add, person, trash, mail, key, business, create, personAdd } from 'ionicons/icons';
import { ApiService, User } from '../../services/api';

@Component({
  selector: 'app-team',
  templateUrl: './team.page.html',
  styleUrls: ['./team.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class TeamPage implements OnInit {

  users: User[] = [];
  currentUserEmail: string = '';
  isModalOpen = false;
  isEditing = false;
  
  // Objet tampon pour le formulaire
  userData = {
    id: 0,
    nom: '',        // ✅ C'est ce champ qui est relié au HTML
    email: '',
    role: 'Conducteur',
    password: ''
  };

  constructor(
    private api: ApiService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {
    addIcons({ personAdd, create, trash, add, person, mail, key, business });
  }

  ngOnInit() {
    this.loadUsers();
    this.api.getMe().subscribe(u => this.currentUserEmail = u.email);
  }

  loadUsers() {
    this.api.getTeam().subscribe({
      next: (data) => {
        this.users = data;
      },
      error: (err) => console.error("Erreur chargement équipe", err)
    });
  }

  // --- MODALE ---

  openAddModal() {
    this.isEditing = false;
    // On remet à zéro le formulaire
    this.userData = { id: 0, nom: '', email: '', role: 'Conducteur', password: '' };
    this.isModalOpen = true;
  }

  openEditModal(user: User) {
    this.isEditing = true;
    // 👇 ON COPIE LES DONNÉES DU MEMBRE DANS LE FORMULAIRE
    this.userData = {
      id: user.id,
      nom: user.nom || '',  // ✅ On récupère bien le nom existant
      email: user.email,
      role: user.role,
      password: '' // On laisse vide par sécurité
    };
    this.isModalOpen = true;
  }

  // --- ACTIONS ---

  saveUser() {
    if (!this.userData.email) {
      this.presentToast('L\'email est obligatoire', 'warning');
      return;
    }

    if (this.isEditing) {
      // MODE MODIFICATION
      const payload: any = {
        nom: this.userData.nom, // ✅ On envoie bien 'nom'
        email: this.userData.email,
        role: this.userData.role
      };
      
      // On n'envoie le mot de passe que s'il a été changé
      if (this.userData.password && this.userData.password.trim() !== '') {
        payload.password = this.userData.password;
      }

      this.api.updateTeamMember(this.userData.id, payload).subscribe({
        next: () => {
          this.presentToast('Membre modifié avec succès', 'success');
          this.isModalOpen = false;
          this.loadUsers(); // 🔄 On rafraîchit la liste immédiatement
        },
        error: (err) => {
          console.error(err);
          this.presentToast('Erreur lors de la modification', 'danger');
        }
      });

    } else {
      // MODE CRÉATION (INVITATION)
      if (!this.userData.password) {
        this.presentToast('Mot de passe obligatoire pour créer', 'warning');
        return;
      }

      this.api.inviteMember(this.userData).subscribe({
        next: () => {
          this.presentToast('Invitation envoyée !', 'success');
          this.isModalOpen = false;
          this.loadUsers();
        },
        error: (err) => {
          console.error(err);
          this.presentToast('Erreur lors de l\'invitation', 'danger');
        }
      });
    }
  }

  async deleteUser(user: User) {
    const alert = await this.alertCtrl.create({
      header: 'Confirmer',
      message: `Voulez-vous vraiment supprimer ${user.nom || user.email} ?`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: () => {
            this.api.deleteMember(user.id).subscribe(() => {
              this.presentToast('Utilisateur supprimé', 'success');
              this.loadUsers();
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // --- UI UTILS ---

  getInitials(user: User): string {
    if (user.nom) {
      return user.nom.substring(0, 2).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  }

  async presentToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    toast.present();
  }
}