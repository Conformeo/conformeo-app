import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController, ModalController } from '@ionic/angular'; // ✅ Ajout de ModalController
import { ApiService } from '../../services/api';
import { add, trashOutline, checkboxOutline, squareOutline, alertCircleOutline, flameOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';

// ✅ IMPORTANT : Importez la page de la modale pour pouvoir l'ouvrir
import { PermisFeuModalPage } from '../../pages/tasks/permis-feu-modal/permis-feu-modal.page';

@Component({
  selector: 'app-task-list',
  templateUrl: './task-list.component.html',
  styleUrls: ['./task-list.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class TaskListComponent implements OnInit {
  @Input() chantierId: number = 0;
  
  tasks: any[] = [];
  newTaskTitle: string = '';

  // ⚠️ Liste des mots-clés déclencheurs
  dangerousKeywords = [
    'soudure', 'souder', 'feu', 'flamme', 'chalumeau', 
    'meulage', 'disqueuse', 'étincelle', 'chaud', 'plomb',
    'amiante', 'gaz', 'toiture', 'hauteur'
  ];

  constructor(
    private api: ApiService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController // ✅ On remplace NavController par ModalController pour les popups
  ) {
    addIcons({ add, trashOutline, checkboxOutline, squareOutline, alertCircleOutline, flameOutline });
  }

  ngOnInit() {
    if (this.chantierId) {
      this.loadTasks();
    }
  }

  loadTasks() {
    this.api.getTasks(this.chantierId).subscribe(data => {
      this.tasks = data;
    });
  }

  async addTask() {
    // VÉRIFICATION DE SÉCURITÉ
    if (!this.chantierId || this.chantierId <= 0) {
      console.error("❌ Erreur : ID Chantier invalide (" + this.chantierId + ")");
      this.presentToast("Impossible de créer la tâche : Chantier non identifié.", "danger");
      return;
    }
    if (!this.newTaskTitle.trim()) return;

    // Préparation de la donnée
    const taskData = {
      titre: this.newTaskTitle,
      description: this.newTaskTitle, 
      chantier_id: this.chantierId,
      fait: false,
      date: new Date().toISOString().split('T')[0]
    };

    const titleToCheck = this.newTaskTitle;

    // 1. Envoi au Backend
    this.api.createTask(taskData).subscribe({
      next: (newTask: any) => {
        this.tasks.push(newTask);
        this.newTaskTitle = ''; // Reset input

        // 2. INTELLIGENCE LOCALE
        this.checkRiskAndPrompt(titleToCheck);
      },
      error: (err) => {
        console.error(err);
        this.presentToast("Erreur lors de la création de la tâche", "danger");
      }
    });
  }

  // --- GESTION OUVERTURE MODALE (La clé du correctif) ---
  async openPermisFeuModal() {
    const modal = await this.modalCtrl.create({
      component: PermisFeuModalPage,
      componentProps: { 
        chantierId: this.chantierId // 👈 On passe l'ID directement ici
      }
    });

    await modal.present();

    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') {
      // Optionnel : Rafraichir quelque chose si besoin
    }
  }

  // --- MOTEUR D'INTELLIGENCE & SÉCURITÉ ---
  
  isRisky(text: string): boolean {
    if (!text) return false;
    return this.dangerousKeywords.some(k => text.toLowerCase().includes(k));
  }

  async checkRiskAndPrompt(titre: string) {
    if (this.isRisky(titre)) {
      const alert = await this.alertCtrl.create({
        header: '🔥 Risque Détecté',
        subHeader: `La tâche "${titre}" implique des points chauds ou des risques.`,
        message: 'La réglementation impose un Permis de Feu ou une vérification DUERP.',
        buttons: [
          { text: 'Ignorer', role: 'cancel' },
          { 
            text: '📄 Créer Permis Feu', 
            handler: () => {
              // ✅ CORRECTION : Appel de la fonction locale qui ouvre la modale
              this.openPermisFeuModal();
            }
          },
          {
            text: '🛡️ Voir DUERP',
            handler: () => {
              // Ici on garde le Router car c'est une autre page complète
              // (Note: assurez-vous d'avoir injecté NavController si vous utilisez ceci, 
              // sinon supprimez ce bouton ou utilisez window.open pour le PDF)
              this.presentToast("Redirection DUERP (à implémenter)", "warning");
            }
          }
        ]
      });
      await alert.present();
    }
  }

  // --- ACTIONS TÂCHES ---

  async deleteTask(task: any) {
    this.api.deleteTask(task.id).subscribe(() => {
      this.tasks = this.tasks.filter(t => t.id !== task.id);
    });
  }

  async toggleTask(task: any) {
    task.fait = !task.fait; 
    this.api.updateTask(task.id, { fait: task.fait }).subscribe();
  }

  async presentToast(msg: string, color: string = 'success') {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, color: color });
    t.present();
  }
}