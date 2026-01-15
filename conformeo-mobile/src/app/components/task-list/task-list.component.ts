import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { ApiService } from '../../services/api';
import { add, trashOutline, checkboxOutline, squareOutline, alertCircleOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { ModalController } from '@ionic/angular';
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
  newTaskDesc: string = '';

  constructor(
    private api: ApiService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController
  ) {
    addIcons({ add, trashOutline, checkboxOutline, squareOutline, alertCircleOutline });
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

  // ... (imports et constructor restent pareils)

  async addTask() {
    if (!this.newTaskDesc.trim()) return;

    const taskData = {
      description: this.newTaskDesc,
      chantier_id: this.chantierId, // Assurez-vous que c'est bien this.chantierId (lié au @Input)
      status: 'TODO',
      date_prevue: new Date()
    };

    // 1. Envoi au Backend
    this.api.createTask(taskData).subscribe(async (newTask: any) => {
      this.tasks.push(newTask);
      this.newTaskDesc = '';

      // 2. VÉRIFICATION DE LA RÉPONSE BACKEND
      // Si le backend a détecté un risque, il a renvoyé 'alert_type' et 'alert_message'
      if (newTask.alert_type) {
        await this.handleRiskAlert(newTask);
      }
    });
  }

  async openPermisFeuModal() {
    const modal = await this.modalCtrl.create({
      component: PermisFeuModalPage
    });
    await modal.present();

    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') {
      this.presentToast("✅ Permis de Feu généré et archivé !", "success");
    }
  }

  // Nouvelle méthode pour gérer l'alerte reçue du serveur
  async handleRiskAlert(task: any) {
    
    // CAS 1 : PERMIS DE FEU
    if (task.alert_type === 'PERMIS_FEU') {
      const alert = await this.alertCtrl.create({
        header: '🔥 Risque Feu Détecté',
        subHeader: 'Analyse Conforméo',
        message: task.alert_message,
        buttons: [
          { text: 'Ignorer', role: 'cancel' },
          { 
            text: '📄 Créer Permis de Feu', 
            handler: () => {
              this.openPermisFeuModal(); // 👈 Appel de la fonction
            }
          }
        ]
      });
      await alert.present();
    }

    // CAS 2 : DUERP / AUTRE
    else {
       const t = await this.toastCtrl.create({
         message: `⚠️ ${task.alert_message}`,
         duration: 4000,
         color: 'warning',
         position: 'top',
         icon: 'alert-circle'
       });
       t.present();
    }
  }

  // ... (deleteTask, toggleTask restent pareils)

  // --- MOTEUR D'INTELLIGENCE (Front-End Handler) ---
  async checkTaskIntelligence(task: any) {
    // Simulation temporaire avant branchement Backend IA
    const desc = task.description.toLowerCase();
    
    // Cas 1 : Risque Feu détecté
    if (desc.includes('soudure') || desc.includes('feu') || desc.includes('coupe')) {
      const alert = await this.alertCtrl.create({
        header: '🔥 Risque Feu Détecté',
        message: 'Cette tâche nécessite un Permis de Feu. Voulez-vous le générer maintenant ?',
        buttons: [
          { text: 'Plus tard', role: 'cancel' },
          { 
            text: 'Générer Permis', 
            handler: () => {
              // TODO: Redirection vers page Permis de Feu ou génération auto
              console.log("Génération Permis Feu..."); 
            }
          }
        ]
      });
      await alert.present();
    }

    // Cas 2 : Risque Hauteur / DUERP
    if (desc.includes('toiture') || desc.includes('echafaudage')) {
       // TODO: Proposer mise à jour DUERP
       this.presentToast("⚠️ Pensez à mettre à jour le DUERP (Risque Chute)", "warning");
    }
  }

  async deleteTask(task: any) {
    this.api.deleteTask(task.id).subscribe(() => {
      this.tasks = this.tasks.filter(t => t.id !== task.id);
    });
  }

  async toggleTask(task: any) {
    const newStatus = task.status === 'TODO' ? 'DONE' : 'TODO';
    task.status = newStatus; // Optimistic UI
    this.api.updateTask(task.id, { status: newStatus }).subscribe();
  }

  async presentToast(msg: string, color: string = 'success') {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, color: color });
    t.present();
  }
}