import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonIcon, IonFab, IonFabButton, 
  IonRefresher, IonRefresherContent, ModalController,
  IonButtons, IonButton, NavController // <--- AJOUT NavController
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
// 👇 AJOUT DE TOUTES LES ICONES MANQUANTES
import { 
  business, location, checkmarkCircle, alertCircle, add, 
  statsChartOutline, hammerOutline, cloudDone, cloudOffline, 
  syncOutline, construct, documentTextOutline, locationOutline,
  chevronForwardOutline // <--- CELLE DU WARNING
} from 'ionicons/icons'; 

import { ApiService, Chantier } from '../services/api';
import { OfflineService } from '../services/offline';
import { AddChantierModalComponent } from './add-chantier-modal/add-chantier-modal.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent,  
    IonIcon, IonFab, IonFabButton, 
    IonRefresher, IonRefresherContent, IonButtons, IonButton,
  ],
})
export class HomePage implements OnInit {
  chantiers: Chantier[] = [];
  isOnline = true;

  constructor(
    public api: ApiService,
    private modalCtrl: ModalController,
    public offline: OfflineService,
    private navCtrl: NavController // <--- INJECTION NAVIGATION
  ) {
    // Enregistrement des icônes
    addIcons({ 
      business, location, checkmarkCircle, alertCircle, add, 
      statsChartOutline, hammerOutline, cloudDone, cloudOffline, 
      syncOutline, construct, documentTextOutline, locationOutline,
      chevronForwardOutline 
    });
  }

  ngOnInit() {
    this.offline.isOnline.subscribe(state => {
      this.isOnline = state;
    });
    this.loadChantiers();
  }
  
  ionViewWillEnter() {
    // Recharge la liste quand on revient sur la page (ex: après création)
    this.loadChantiers();
  }

  loadChantiers(event?: any) {
    this.api.getChantiers().subscribe(data => {
      this.chantiers = data.reverse(); // Plus récent en haut
      if (event) event.target.complete();
    });
  }

  async openAddModal() {
    const modal = await this.modalCtrl.create({
      component: AddChantierModalComponent
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm') {
      this.loadChantiers();
    }
  }

  // 👇 FONCTION DE NAVIGATION (Celle qui manquait)
  navigateTo(url: string) {
    this.navCtrl.navigateForward(url);
  }

  // Helper pour la date
  getDaysOpen(dateString?: string): number {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diff / (1000 * 3600 * 24)); 
  }
}