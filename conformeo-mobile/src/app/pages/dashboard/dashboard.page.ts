import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular'; // Ajout NavController
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartOptions, registerables } from 'chart.js';
import { addIcons } from 'ionicons';
import { business, documentText, hammer, warning, cameraOutline } from 'ionicons/icons';
import { ApiService } from 'src/app/services/api'; // Vérifiez le chemin (.service)
import * as L from 'leaflet'; 

// Enregistrement des composants graphiques
Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, BaseChartDirective, RouterLink]
})
export class DashboardPage implements OnInit {

  // Données KPIs
  stats: any = {
    actifs: 0,
    rapports: 0,
    materiel_sorti: 0,
    alertes: 0
  };

  // Données Liste
  recentRapports: any[] = [];
  
  // Carte Leaflet
  map: any;

  // Config Graphique
  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      { data: [], label: 'Rapports', backgroundColor: '#1e3c72', borderRadius: 5 }
    ]
  };
  public barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } }
  };

  constructor(
    private api: ApiService,
    private navCtrl: NavController // Pour rediriger si la session est expirée
  ) {
    addIcons({ business, documentText, hammer, warning, cameraOutline });  
  }
  

  ngOnInit() {
    // 👇 LA CORRECTION EST ICI 👇
    // 1. On vérifie d'abord que l'utilisateur est bien connecté/reconnu
    this.api.getMe().subscribe({
      next: (user) => {
        console.log("✅ Dashboard : Session validée pour", user.email);
        // 2. SEULEMENT MAINTENANT, on charge les données
        this.loadDashboardData();
      },
      error: (err) => {
        console.error("❌ Dashboard : Session invalide ou expirée", err);
        // Si getMe échoue, on renvoie au login pour éviter l'écran vide
        this.api.logout();
      }
    });
  }

  loadDashboardData() {
    console.log("🔄 Chargement des stats...");
    this.api.getStats().subscribe({
      next: (data) => {
        // 1. KPIs
        if (data.kpis) {
          this.stats = data.kpis;
        }

        // 2. Liste Récents
        if (data.recents) {
          this.recentRapports = data.recents;
        }
        
        // 3. Graphique (Mise à jour dynamique)
        if (data.chart) {
          this.barChartData = {
            labels: data.chart.labels,
            datasets: [{ 
              data: data.chart.values, 
              label: 'Rapports', 
              backgroundColor: '#1e3c72', 
              borderRadius: 5 
            }]
          };
        }

        // 4. Carte (Avec petit délai pour que le HTML soit prêt)
        if (data.map) {
          setTimeout(() => {
            this.initMap(data.map);
          }, 500);
        }
      },
      error: (err) => console.error("Erreur chargement stats:", err)
    });
  }

  initMap(sites: any[]) {
    // Sécurité : Si la carte existe déjà, on la nettoie pour éviter les bugs Leaflet
    if (this.map) {
        this.map.remove();
        this.map = null;
    }

    // Le container doit exister
    if (!document.getElementById('mapId')) return;

    // 👇 LE FIX MAGIQUE POUR LES ICONES PERDUES 👇
    const iconRetinaUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png';
    const iconUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png';
    const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';
    
    const defaultIcon = L.icon({
      iconUrl: iconUrl,
      iconRetinaUrl: iconRetinaUrl,
      shadowUrl: shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = defaultIcon;
    // 👆 FIN DU FIX 👆

    // Centre sur le premier chantier ou la France
    const center = sites.length > 0 ? [sites[0].lat, sites[0].lng] : [46.603354, 1.888334];
    const zoom = sites.length > 0 ? 12 : 5; 

    this.map = L.map('mapId').setView(center as any, zoom);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.map);

    // Ajouter les épingles
    sites.forEach(s => {
       if (s.lat && s.lng) {
         L.marker([s.lat, s.lng])
          .addTo(this.map)
          .bindPopup(`<b>${s.nom}</b><br>${s.client}`);
       }
    });
    
    // Hack pour forcer le redessin correct de la carte
    setTimeout(() => { this.map.invalidateSize(); }, 200);
  }
}