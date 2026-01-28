import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
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

  // 👇 Initialisation avec des valeurs par défaut
  stats: any = {
    actifs: 0,          // Sera rempli par nb_chantiers
    materiel_sorti: 0,  // Sera rempli par nb_materiels
    rapports: 0,
    alertes: 0,
    last_reports: []
  };

  recentRapports: any[] = [];
  map: any;

  // Config Graphique (Vide par défaut)
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
      next: (response: any) => {
        console.log("🔥 Données reçues du Backend :", response);

        // 1. On récupère les données (peu importe si elles sont dans 'data' ou à la racine)
        // Grâce à notre modification backend, 'response' contient directement les chiffres
        const d = response.data || response;

        // 2. MAPPING MANUEL : On connecte les fils ! 🔌
        // On force les variables de l'écran (gauche) à prendre les valeurs du JSON (droite)
        this.stats = {
          // L'écran attend 'actifs', le JSON envoie 'nb_chantiers' (ou 'chantiers')
          actifs: d.nb_chantiers || d.nbChantiers || d.chantiers || 0,
          
          // L'écran attend 'materiel_sorti', le JSON envoie 'nb_materiels'
          materiel_sorti: d.nb_materiels || d.nbMateriels || d.materiels || 0,
          
          rapports: d.nb_rapports || 0, 
          alertes: 0,
          last_reports: d.recents || []
        };

        // 3. Mise à jour des listes si présentes
        if (d.recents) {
            this.recentRapports = d.recents;
            this.stats.last_reports = d.recents; 
        }
        
        // 4. Gestion du Graphique
        if (d.chart) {
          this.barChartData = {
            labels: d.chart.labels,
            datasets: [{ 
              data: d.chart.values, 
              label: 'Rapports', 
              backgroundColor: '#1e3c72', 
              borderRadius: 5 
            }]
          };
        }

        // 5. Gestion de la Carte
        if (d.map) {
          setTimeout(() => { this.initMap(d.map); }, 500);
        }
      },
      error: (err) => console.error("Erreur chargement stats:", err)
    });
  }

  goToReport(report: any) {
    if (!report.chantier_id) {
      console.warn("Impossible d'ouvrir : Rapport sans chantier ID");
      return;
    }
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

    // Fix pour les icônes Leaflet manquantes
    const iconRetinaUrl = 'assets/marker-icon-2x.png'; 
    const iconUrl = 'assets/marker-icon.png';
    const shadowUrl = 'assets/marker-shadow.png';
    
    // On utilise des CDN si les assets locaux manquent, sinon ça plante
    const L_im = L.Icon.Default.prototype as any;
    L_im._getIconUrl = null;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

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