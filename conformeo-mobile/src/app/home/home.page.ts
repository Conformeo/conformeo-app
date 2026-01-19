import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, 
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, 
  IonChip, IonIcon, IonLabel, IonFab, IonFabButton, 
  IonRefresher, IonRefresherContent, ModalController,
  IonButtons, IonButton, IonBadge, NavController, IonSearchbar, 
  LoadingController, AlertController // <--- AJOUT AlertController
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { 
  business, location, checkmarkCircle, alertCircle, add, 
  statsChartOutline, hammerOutline, cloudDone, cloudOffline, 
  syncOutline, construct, documentTextOutline, locationOutline,
  chevronForwardOutline, cloudUploadOutline, searchOutline 
} from 'ionicons/icons'; 

import { ApiService, Chantier } from '../services/api';
import { OfflineService } from '../services/offline';
import { AddChantierModalComponent } from './add-chantier-modal/add-chantier-modal.component';
import * as L from 'leaflet';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonList, 
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, 
    IonChip, IonIcon, IonLabel, IonFab, IonFabButton, 
    IonRefresher, IonRefresherContent, IonButtons, IonButton,
    IonBadge, IonSearchbar
  ],
})
export class HomePage implements OnInit {
  chantiers: Chantier[] = [];
  filteredChantiers: Chantier[] = [];
  searchTerm: string = '';
  isOnline = true;

  stats: any = {
    kpis: { total_chantiers: 0, actifs: 0, rapports: 0, alertes: 0, materiel_sorti: 0 },
    recents: [],
    map: [] 
  };

  map: L.Map | undefined;

  constructor(
    public api: ApiService,
    private modalCtrl: ModalController,
    public offline: OfflineService,
    private navCtrl: NavController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController, // <--- Injection
    private router: Router,
    private ngZone: NgZone
  ) {
    addIcons({ 
      business, location, checkmarkCircle, alertCircle, add, 
      statsChartOutline, hammerOutline, cloudDone, cloudOffline, 
      syncOutline, construct, documentTextOutline, locationOutline,
      chevronForwardOutline, cloudUploadOutline, searchOutline
    });

    (window as any).openChantier = (id: number) => {
      this.ngZone.run(() => {
        this.router.navigate(['/chantiers', id]);
      });
    };
  }

  ngOnInit() {
    this.offline.isOnline.subscribe(state => this.isOnline = state);
    this.loadChantiers();
    this.loadDashboard();
  }
  
  ionViewWillEnter() {
    if (this.api.needsRefresh) {
        this.loadChantiers();
        this.api.needsRefresh = false;
    }
    this.loadDashboard();
  }

  loadDashboard() {
    this.api.getStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.initMap(data.map); 
      },
      error: (err) => console.error(err)
    });
  }

  initMap(sites: any[]) {
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }

    setTimeout(() => {
      const container = document.getElementById('map');
      if (!container) return;

      const centerLat = sites.length > 0 ? sites[0].lat : 46.603354;
      const centerLng = sites.length > 0 ? sites[0].lng : 1.888334;
      const zoomLevel = sites.length > 0 ? 10 : 5;

      this.map = L.map('map').setView([centerLat, centerLng], zoomLevel);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(this.map!);

      // Configurer les icônes Leaflet correctement
      const iconDefault = L.icon({
        iconUrl: 'assets/icon/marker-icon.png', 
        shadowUrl: 'assets/icon/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
      });

      sites.forEach(site => {
        if (site.lat && site.lng) {
          // Utilisation de l'icône configurée
          const marker = L.marker([site.lat, site.lng], { icon: iconDefault });

          const popupHtml = `
            <div style="text-align: center; font-family: sans-serif;">
              <b style="font-size: 14px; color: #333;">${site.nom}</b><br>
              <span style="font-size: 12px; color: #666;">${site.client}</span><br>
              <button onclick="window.openChantier(${site.id})" 
                style="margin-top: 10px; background-color: #3880ff; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-size: 12px; cursor: pointer; width: 100%;">
                Voir le dossier 👉
              </button>
            </div>
          `;

          marker.addTo(this.map!).bindPopup(popupHtml);
        }
      });

    }, 200);
  }

  // loadChantiers(event?: any) {
  //   this.api.getChantiers().subscribe(data => {
  //     this.chantiers = data.reverse();
  //     this.filterChantiers(); 
  //     if (event) event.target.complete();
  //   });
  // }

  loadChantiers(event?: any) {
    this.api.getChantiers().subscribe(data => {
      
      // 👇 AJOUTEZ CES LOGS
      console.log("-------------------------------------------------");
      console.log("🔎 DEBUG CHANTIERS REÇUS API:", data.length);
      console.log("📋 LISTE:", data);
      console.log("-------------------------------------------------");

      this.chantiers = data.reverse();
      this.filterChantiers();
      
      if (event) event.target.complete();
    });
  }

  filterChantiers() {
    const term = this.searchTerm.toLowerCase();
    if (!term) {
      this.filteredChantiers = this.chantiers;
    } else {
      this.filteredChantiers = this.chantiers.filter(c => 
        (c.nom?.toLowerCase() || '').includes(term) || 
        (c.client?.toLowerCase() || '').includes(term) ||
        (c.adresse?.toLowerCase() || '').includes(term)
      );
    }
  }

  async onCSVSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const loading = await this.loadingCtrl.create({ message: 'Import en cours...' });
      await loading.present();

      this.api.importChantiersCSV(file).subscribe({
        next: async (res) => {
          loading.dismiss();
          const alert = await this.alertCtrl.create({
            header: 'Succès',
            message: res.message,
            buttons: ['OK']
          });
          await alert.present();
          this.loadChantiers();
        },
        error: async (err) => {
          loading.dismiss();
          const errorMsg = err.error?.detail || err.message || JSON.stringify(err);
          const alert = await this.alertCtrl.create({
            header: 'Erreur Serveur',
            message: errorMsg,
            buttons: ['OK']
          });
          await alert.present();
        }
      });
    }
  }

  async openAddModal() {
    const modal = await this.modalCtrl.create({
      component: AddChantierModalComponent
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') this.loadChantiers();
  }

  navigateTo(url: string) {
    this.navCtrl.navigateForward(url);
  }

  getDaysOpen(dateString?: string): number {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diff / (1000 * 3600 * 24)); 
  }

  getCoverUrl(url: string | undefined): string {
    if (!url) return 'assets/splash.png';
    if (url.startsWith('http:')) return url.replace('http:', 'https:');
    return url;
  }
}