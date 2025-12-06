import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, Chart, registerables } from 'chart.js';
import { addIcons } from 'ionicons';
import { business, documentText, hammer, warning, cameraOutline } from 'ionicons/icons';
import { ApiService } from 'src/app/services/api';

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

  // Données KPIs (Initialisées à 0)
  stats: any = {
    actifs: 0,
    rapports: 0,
    materiel_sorti: 0,
    alertes: 0
  };

  // Données Liste
  recentRapports: any[] = [];

  // Config Graphique
  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    datasets: [
      { data: [0, 0, 0, 0, 0, 0, 0], label: 'Rapports', backgroundColor: '#1e3c72', borderRadius: 5 }
    ]
  };
  public barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } }
  };

  constructor(private api: ApiService) {
    addIcons({ business, documentText, hammer, warning, cameraOutline });
  }

  ngOnInit() {
    // --- 1. Appel API pour les KPIs ---
    this.api.getStats().subscribe(data => {
      // On suppose que l'API renvoie un objet simple pour l'instant
      this.stats = data; 
      
      // --- 2. Simulation Graphique & Liste (En attendant l'API avancée) ---
      this.simulateData();
    });
  }

  simulateData() {
    // Simulation Graphique
    this.barChartData = {
      labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
      datasets: [{ data: [5, 8, 12, 7, 10, 2, 0], label: 'Rapports', backgroundColor: '#1e3c72', borderRadius: 5 }]
    };

    // Simulation Liste
    this.recentRapports = [
      { titre: 'Inspection Toiture', date_creation: new Date(), chantier_nom: 'Résidence Fleurs', niveau_urgence: 'Faible' },
      { titre: 'Fissure Mur Nord', date_creation: new Date(), chantier_nom: 'Gare du Nord', niveau_urgence: 'Critique' },
      { titre: 'Livraison Placo', date_creation: new Date(), chantier_nom: 'Villa Corse', niveau_urgence: 'Moyen' },
    ];
  }
}