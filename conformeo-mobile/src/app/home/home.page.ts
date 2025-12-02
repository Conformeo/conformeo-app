import { Component, OnInit } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonChip, IonIcon, IonLabel, IonFab, IonFabButton, IonRefresher, IonRefresherContent, ModalController, IonButtons, IonButton, IonBadge } from '@ionic/angular/standalone';
import { ApiService, Chantier } from '../services/api';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { business, location, checkmarkCircle, alertCircle, add, statsChartOutline, hammerOutline, cloudDone, cloudOffline, syncOutline, construct } from 'ionicons/icons';
import { AddChantierModalComponent } from './add-chantier-modal/add-chantier-modal.component'; // <--- Import du composant
import { RouterLink } from '@angular/router';
// import { IonButton } from '@ionic/angular';

import { OfflineService } from '../services/offline'; // Service de gestion offline

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [CommonModule, 
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonContent, 
    // IonList, 
    // IonCard, 
    // IonCardHeader, 
    // IonCardTitle, 
    // IonCardSubtitle, 
    // IonCardContent, 
    // IonChip, 
    IonIcon, 
    // IonLabel, 
    IonFab, 
    IonFabButton, 
    IonRefresher, 
    IonRefresherContent,
    IonButtons,
    RouterLink, 
    IonButton,
    // IonBadge
  ],
})
export class HomePage implements OnInit {
  chantiers: Chantier[] = [];
  isOnline = true; 

  constructor(
    private api: ApiService,
    private modalCtrl: ModalController,
    private offline: OfflineService
  ) {
addIcons({ business, location, checkmarkCircle, alertCircle, add, statsChartOutline, hammerOutline, cloudDone, cloudOffline, syncOutline, construct });  }

  ngOnInit() {
    // On écoute le réseau en temps réel
    this.offline.isOnline.subscribe(state => {
      this.isOnline = state;
    });

    this.loadChantiers();
  }

  getDaysOpen(dateString?: string): number {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diff / (1000 * 3600 * 24));
  }

  loadChantiers(event?: any) {
    this.api.getChantiers().subscribe({
      next: (data) => {
        this.chantiers = data;
        if (event) event.target.complete();
      },
      error: (err) => { console.error(err); if(event) event.target.complete(); }
    });
  }

  // --- NOUVELLE FONCTION ---
  async openAddModal() {
    const modal = await this.modalCtrl.create({
      component: AddChantierModalComponent,
    });

    modal.present();

    // On attend que la modale se ferme
    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      // Si l'utilisateur a créé un chantier, on l'ajoute directement à la liste
      this.chantiers.push(data);
    }
  }

  forceSync() {
    // On passe 'api' au service pour qu'il puisse l'utiliser
    this.offline.debugSyncProcess(this.api);
  }
}