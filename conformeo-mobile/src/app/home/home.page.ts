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
  LoadingController // <--- AJOUT
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { 
  business, location, checkmarkCircle, alertCircle, add, 
  statsChartOutline, hammerOutline, cloudDone, cloudOffline, 
  syncOutline, construct, documentTextOutline, locationOutline,
  chevronForwardOutline, cloudUploadOutline, searchOutline // <--- AJOUTS
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
  filteredChantiers: Chantier[] = []; // Liste filtrée pour la recherche
  searchTerm: string = '';
  isOnline = true;

  stats: any = {
    kpis: { total_chantiers: 0, actifs: 0, rapports: 0, alertes: 0, materiel_sorti: 0 },
    recents: [],
    map: [] // La liste des points GPS
  };

  map: L.Map | undefined;

  constructor(
    public api: ApiService,
    private modalCtrl: ModalController,
    public offline: OfflineService,
    private navCtrl: NavController,
    private loadingCtrl: LoadingController,
    private router: Router,   // 👈 Pour naviguer
    private ngZone: NgZone
  ) {
    addIcons({ 
      business, location, checkmarkCircle, alertCircle, add, 
      statsChartOutline, hammerOutline, cloudDone, cloudOffline, 
      syncOutline, construct, documentTextOutline, locationOutline,
      chevronForwardOutline, cloudUploadOutline, searchOutline
    });
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
        this.initMap(data.map); // On lance la carte avec les données reçues
      },
      error: (err) => console.error(err)
    });
  }

  initMap(sites: any[]) {
    // Si la carte existe déjà, on la nettoie pour éviter les doublons
    if (this.map) {
      this.map.remove();
    }

    // On attend un petit peu que le HTML soit prêt (sécurité)
    setTimeout(() => {
      const container = document.getElementById('map');
      if (!container) return;

      // 1. Centrer la carte (Par défaut sur la France ou sur le 1er chantier)
      const centerLat = sites.length > 0 ? sites[0].lat : 46.603354;
      const centerLng = sites.length > 0 ? sites[0].lng : 1.888334;
      const zoomLevel = sites.length > 0 ? 10 : 5;

      this.map = L.map('map').setView([centerLat, centerLng], zoomLevel);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(this.map);

      // 2. Ajouter les épingles
      const iconDefault = L.icon({
        iconUrl: 'assets/icon/marker-icon.png', // Assurez-vous d'avoir une icône ou utilisez celle par défaut de Leaflet
        shadowUrl: 'assets/icon/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
      });

      sites.forEach(site => {
        const marker = L.marker([site.lat, site.lng]) // On peut ajouter {icon: iconDefault} si vous avez les assets
          .addTo(this.map!)
          .bindPopup(`<b>${site.nom}</b><br>${site.client}`);

        // 👇 LE CLICK MAGIQUE 👇
        marker.on('click', () => {
          this.ngZone.run(() => {
            // Redirection vers la page détail du chantier
            this.router.navigate(['/chantiers', site.id]);
          });
        });
      });

    }, 200);
  }

  loadChantiers(event?: any) {
    this.api.getChantiers().subscribe(data => {
      this.chantiers = data.reverse();
      this.filterChantiers(); // On applique le filtre tout de suite
      if (event) event.target.complete();
    });
  }

  // 👇 MOTEUR DE RECHERCHE
  filterChantiers() {
    const term = this.searchTerm.toLowerCase();
    if (!term) {
      this.filteredChantiers = this.chantiers;
    } else {
      this.filteredChantiers = this.chantiers.filter(c => 
        c.nom.toLowerCase().includes(term) || 
        c.client.toLowerCase().includes(term) ||
        c.adresse.toLowerCase().includes(term)
      );
    }
  }

  // 👇 IMPORT CSV
  async onCSVSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const loading = await this.loadingCtrl.create({ message: 'Import en cours...' });
      await loading.present();

      this.api.importChantiersCSV(file).subscribe({
        next: (res) => {
          loading.dismiss();
          alert(res.message);
          this.loadChantiers(); // Rafraîchir la liste
        },
        error: (err) => {
          loading.dismiss();
alert("Erreur Serveur : " + (err.error?.detail || err.message || JSON.stringify(err)));        }
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