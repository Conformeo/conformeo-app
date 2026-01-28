import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
import { RouterLink, Router } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartOptions, registerables } from 'chart.js';
import { addIcons } from 'ionicons';
// 👇 On ajoute toutes les icônes utilisées pour éviter le warning "chevron-forward"
import { business, documentText, hammer, warning, cameraOutline, chevronForward, partlySunny } from 'ionicons/icons';
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
    materiel_sorti: 0,
    rapports: 0,
    alertes: 0,
    last_reports: []
  };

  recentRapports: any[] = [];
  map: any;

  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'],
    datasets: [
      { data: [2, 4, 1, 6, 3], label: 'Rapports', backgroundColor: '#1e3c72', borderRadius: 5 }
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
    // Enregistrement des icônes pour éviter les warnings
    addIcons({ business, documentText, hammer, warning, cameraOutline, chevronForward, partlySunny });  
  }
  
  ngOnInit() {
    this.api.getMe().subscribe({
      next: (user) => {
        this.loadDashboardData();
      },
      error: (err) => console.error(err)
    });
  }

  loadDashboardData() {
    this.api.getStats().subscribe({
      next: (response: any) => {
        const d = response.data || response;
        console.log("🔥 Données reçues du Backend :", d);

        // 1. Mise à jour des chiffres (On force l'affichage AVANT la carte)
        // On utilise setTimeout pour s'assurer que Angular met à jour la vue
        setTimeout(() => {
            this.stats = {
              actifs: d.nb_chantiers || d.nbChantiers || 0,
              materiel_sorti: d.nb_materiels || d.nbMateriels || 0,
              rapports: d.nb_rapports || 0, 
              alertes: d.alertes || d.nbAlertes || 0, // Ici on devrait avoir 11 !
              last_reports: d.recents || []
            };
            
            if (d.recents) {
                this.recentRapports = d.recents;
            }
        }, 0);

        // 2. Initialisation de la carte (Dans un try-catch pour ne pas tout bloquer)
        if (d.map && d.map.length > 0) {
          setTimeout(() => { 
            try {
                this.initMap(d.map); 
            } catch (e) {
                console.error("❌ Erreur critique Carte :", e);
            }
          }, 500);
        }
      },
      error: (err) => console.error("Erreur stats:", err)
    });
  }

  goToReport(report: any) {
    if (!report.chantier_id) return;
    this.router.navigate(['/chantier-details', report.chantier_id], {
      queryParams: { openReportId: report.id }
    });
  }

  initMap(sites: any[]) {
    // Nettoyage de l'ancienne carte
    if (this.map) {
        this.map.remove();
        this.map = null;
    }

    const mapContainer = document.getElementById('mapId');
    if (!mapContainer) return;

    // Centrage
    const center = sites.length > 0 ? [sites[0].lat, sites[0].lng] : [46.603354, 1.888334];
    const zoom = sites.length > 0 ? 6 : 5; 

    this.map = L.map('mapId').setView(center as any, zoom);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.map);

    // 👇 LA SOLUTION ULTIME POUR LES ICÔNES 👇
    // On définit manuellement l'icône, sans passer par la détection automatique de Leaflet qui plante
    const myIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    sites.forEach(s => {
       if (s.lat && s.lng) {
         // On passe { icon: myIcon } OBLIGATOIREMENT
         L.marker([s.lat, s.lng], { icon: myIcon })
          .addTo(this.map)
          .bindPopup(`<b>${s.nom}</b><br>${s.client}`);
       }
    });
    
    setTimeout(() => { this.map.invalidateSize(); }, 500);
  }
}