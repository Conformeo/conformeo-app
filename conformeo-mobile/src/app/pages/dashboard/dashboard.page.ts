import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
// 👇 1. AJOUT DE Router ICI
import { RouterLink, Router } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartOptions, registerables } from 'chart.js';
import { addIcons } from 'ionicons';
import { business, documentText, hammer, warning, cameraOutline } from 'ionicons/icons';
import { ApiService } from 'src/app/services/api'; 
import * as L from 'leaflet'; 

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, BaseChartDirective, RouterLink]
})
export class DashboardPage implements OnInit {

  stats: any = {
    actifs: 0,
    rapports: 0,
    materiel_sorti: 0,
    alertes: 0,
    last_reports: []
  };

  recentRapports: any[] = [];
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
    private navCtrl: NavController,
    // 👇 2. INJECTION DU ROUTER ICI
    private router: Router
  ) {
    addIcons({ business, documentText, hammer, warning, cameraOutline });  
  }
  
  ngOnInit() {
    this.api.getMe().subscribe({
      next: (user) => {
        console.log("✅ Dashboard : Session validée pour", user.email);
        this.loadDashboardData();
      },
      error: (err) => {
        console.error("❌ Dashboard : Session invalide ou expirée", err);
      }
    });
  }

  loadDashboardData() {
    console.log("🔄 Chargement des stats...");
    this.api.getStats().subscribe({
      next: (data) => {
        if (data.kpis) this.stats = data.kpis;
        // On s'assure que la liste est bien remplie pour l'affichage
        if (data.recents) {
            this.recentRapports = data.recents;
            // Si votre HTML utilise stats.last_reports, on fait le lien :
            this.stats.last_reports = data.recents; 
        }
        
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

        if (data.map) {
          setTimeout(() => { this.initMap(data.map); }, 500);
        }
      },
      error: (err) => console.error("Erreur chargement stats:", err)
    });
  }

  // 👇 3. NOUVELLE FONCTION POUR OUVRIR LE RAPPORT
  goToReport(report: any) {
    // Vérification de sécurité
    if (!report.chantier_id) {
      console.warn("Impossible d'ouvrir : Rapport sans chantier ID");
      return;
    }

    // Navigation vers la page chantier avec un paramètre pour ouvrir le rapport
    this.router.navigate(['/chantier-details', report.chantier_id], {
      queryParams: { openReportId: report.id }
    });
  }

  initMap(sites: any[]) {
    if (this.map) {
        this.map.remove();
        this.map = null;
    }

    if (!document.getElementById('mapId')) return;

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

    const center = sites.length > 0 ? [sites[0].lat, sites[0].lng] : [46.603354, 1.888334];
    const zoom = sites.length > 0 ? 12 : 5; 

    this.map = L.map('mapId').setView(center as any, zoom);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.map);

    sites.forEach(s => {
       if (s.lat && s.lng) {
         L.marker([s.lat, s.lng])
          .addTo(this.map)
          .bindPopup(`<b>${s.nom}</b><br>${s.client}`);
       }
    });
    
    setTimeout(() => { this.map.invalidateSize(); }, 200);
  }
}