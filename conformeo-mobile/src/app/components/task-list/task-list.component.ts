import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController, NavController } from '@ionic/angular';
import { ApiService } from '../../services/api';
import { add, trashOutline, checkboxOutline, squareOutline, alertCircleOutline, flameOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';

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
    private navCtrl: NavController // Utilisation de NavController pour la redirection
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
    // AJOUTEZ CETTE VÉRIFICATION 👇
    if (!this.chantierId || this.chantierId <= 0) {
      console.error("❌ Erreur : ID Chantier invalide (" + this.chantierId + ")");
      this.presentToast("Impossible de créer la tâche : Chantier non identifié.", "danger");
      return;
    }
    if (!this.newTaskTitle.trim() || !this.chantierId) return;

    // Préparation de la donnée
    const taskData = {
      titre: this.newTaskTitle,
      description: this.newTaskTitle, // On double le titre en description pour être sûr
      chantier_id: this.chantierId,
      fait: false,
      date: new Date().toISOString().split('T')[0]
    };

    // Copie du titre pour l'analyse AVANT que le champ ne soit vidé
    const titleToCheck = this.newTaskTitle;

    // 1. Envoi au Backend
    this.api.createTask(taskData).subscribe({
      next: (newTask: any) => {
        this.tasks.push(newTask);
        this.newTaskTitle = ''; // Reset input

        // 2. INTELLIGENCE LOCALE (Plus rapide que le backend)
        this.checkRiskAndPrompt(titleToCheck);
      },
      error: (err) => {
        console.error(err);
        this.presentToast("Erreur lors de la création de la tâche", "danger");
      }
    });
  }

  // --- MOTEUR D'INTELLIGENCE & SÉCURITÉ ---
  
  // Fonction utilitaire pour le HTML (affiche icône feu)
  isRisky(text: string): boolean {
    if (!text) return false;
    // On vérifie le texte en minuscule
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
              // Redirection vers la page de création
              this.navCtrl.navigateForward(['/permis-feu-modal'], {
                queryParams: { chantierId: this.chantierId }
              });
            }
          },
          {
            text: '🛡️ Voir DUERP',
            handler: () => {
              this.navCtrl.navigateForward(['/securite-doc']);
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
    // Gestion "Fait / Pas fait"
    task.fait = !task.fait; 
    // Note: Assurez-vous que votre API attend 'fait' (boolean) ou 'status' (string)
    // Ici j'utilise 'fait' pour simplifier, adaptez selon votre API (ex: status: 'DONE')
    this.api.updateTask(task.id, { fait: task.fait }).subscribe();
  }

  async presentToast(msg: string, color: string = 'success') {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, color: color });
    t.present();
  }
}