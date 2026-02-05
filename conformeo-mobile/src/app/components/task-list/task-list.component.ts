import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController, ModalController } from '@ionic/angular';
import { ApiService } from '../../services/api';
// ✅ AJOUT de 'flame' pour l'icône de risque
import { add, mic, stopCircle, addCircle, flame } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { PermisFeuModalPage } from '../../pages/tasks/permis-feu-modal/permis-feu-modal.page';

import { SpeechRecognition } from '@capacitor-community/speech-recognition';

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
  isRecording: boolean = false;

  dangerousKeywords = [
    'soudure', 'souder', 'feu', 'flamme', 'chalumeau', 
    'meulage', 'disqueuse', 'étincelle', 'chaud', 'plomb',
    'amiante', 'gaz', 'toiture', 'hauteur'
  ];

  constructor(
    private api: ApiService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private cdr: ChangeDetectorRef
  ) {
    // ✅ On enregistre l'icône flame ici
    addIcons({ add, mic, stopCircle, addCircle, flame }); 
  }

  ngOnInit() {
    if (this.chantierId) {
      this.loadTasks();
      // ✅ CORRECTION : requestPermissions (au pluriel)
      SpeechRecognition.requestPermissions().catch(e => console.log('Init vocale ignorée', e));
    }
  }

  loadTasks() {
    this.api.getTasks(this.chantierId).subscribe(data => {
      this.tasks = data;
    });
  }

  async addTask() {
    if (!this.chantierId || this.chantierId <= 0) {
      console.error("❌ Erreur : ID Chantier invalide (" + this.chantierId + ")");
      this.presentToast("Impossible de créer la tâche : Chantier non identifié.", "danger");
      return;
    }
    if (!this.newTaskTitle.trim()) return;

    const taskData = {
      titre: this.newTaskTitle,
      description: this.newTaskTitle, 
      chantier_id: this.chantierId,
      fait: false,
      date: new Date().toISOString().split('T')[0]
    };

    const titleToCheck = this.newTaskTitle;

    this.api.createTask(taskData).subscribe({
      next: (newTask: any) => {
        this.tasks.push(newTask);
        this.newTaskTitle = ''; 
        
        // ✅ UX : On coupe le micro proprement après validation
        this.stopListening();
        
        this.checkRiskAndPrompt(titleToCheck);
      },
      error: (err) => {
        console.error(err);
        this.presentToast("Erreur lors de la création de la tâche", "danger");
      }
    });
  }

  async openPermisFeuModal() {
    const modal = await this.modalCtrl.create({
      component: PermisFeuModalPage,
      componentProps: { 
        chantierId: this.chantierId
      }
    });

    await modal.present();

    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') {
      // Refresh si nécessaire
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
              this.openPermisFeuModal();
            }
          },
          {
            text: '🛡️ Voir DUERP',
            handler: () => {
              this.presentToast("Redirection DUERP (à implémenter)", "warning");
            }
          }
        ]
      });
      await alert.present();
    }
  }

  // --- LOGIQUE VOCALE (CORRIGÉE) ---

  async toggleRecording() {
    // 1. Arrêt si en cours
    if (this.isRecording) {
      this.stopListening();
      return;
    }

    try {
      // 2. ✅ CORRECTION : checkPermissions (au lieu de hasPermission)
      const status = await SpeechRecognition.checkPermissions();
      
      // Si pas accordé, on demande
      if (status.speechRecognition !== 'granted') {
        // ✅ CORRECTION : requestPermissions (au pluriel)
        const newStatus = await SpeechRecognition.requestPermissions();
        if (newStatus.speechRecognition !== 'granted') {
          this.presentToast("Accès micro refusé.", "warning");
          return;
        }
      }

      // 3. Démarrage
      this.isRecording = true;
      this.newTaskTitle = ''; // Vide le champ pour la nouvelle dictée
      this.cdr.detectChanges();
      
      await SpeechRecognition.start({
        language: "fr-FR",
        maxResults: 1,
        prompt: "Dictez votre tâche...",
        partialResults: true,
        popup: false,
      });

      // 4. Écoute des résultats
      SpeechRecognition.addListener('partialResults', (data: any) => {
        if (data.matches && data.matches.length > 0) {
          this.newTaskTitle = data.matches[0];
          this.cdr.detectChanges(); // Mise à jour UI temps réel
        }
      });

    } catch (e) {
      console.error("Erreur dictée:", e);
      this.isRecording = false;
      this.cdr.detectChanges();
    }
  }

  async stopListening() {
    try {
      await SpeechRecognition.stop();
    } catch(e) {
      // On ignore l'erreur si le micro était déjà éteint
    }
    this.isRecording = false;
    this.cdr.detectChanges();
  }

  // --- LOGIQUE BOUTON PRINCIPAL ---

  handleMainAction() {
    if (this.newTaskTitle.trim().length > 0) {
      this.addTask();
    } else {
      this.toggleRecording();
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