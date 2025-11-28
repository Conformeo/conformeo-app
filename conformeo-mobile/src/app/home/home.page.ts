import { Component, OnInit } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonChip, IonIcon, IonLabel, IonFab, IonFabButton, IonRefresher, IonRefresherContent, ModalController, IonButtons } from '@ionic/angular/standalone';
import { ApiService, Chantier } from '../services/api';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { business, location, checkmarkCircle, alertCircle, add, statsChartOutline } from 'ionicons/icons';
import { AddChantierModalComponent } from './add-chantier-modal/add-chantier-modal.component'; // <--- Import du composant
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular';


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
    IonList, 
    IonCard, 
    IonCardHeader, 
    IonCardTitle, 
    IonCardSubtitle, 
    IonCardContent, 
    IonChip, 
    IonIcon, 
    IonLabel, 
    IonFab, 
    IonFabButton, 
    IonRefresher, 
    IonRefresherContent,
    IonButtons,
    RouterLink
  ],
})
export class HomePage implements OnInit {
  chantiers: Chantier[] = [];

  constructor(
    private api: ApiService,
    private modalCtrl: ModalController // <--- Injection du contrôleur de modale
  ) {
    addIcons({ business, location, checkmarkCircle, alertCircle, add, statsChartOutline });
  }

  ngOnInit() {
    this.loadChantiers();
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
}