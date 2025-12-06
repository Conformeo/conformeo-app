import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ApiService } from 'src/app/services/api';
import { BaseChartDirective } from 'ng2-charts';

// 👇 IMPORTS CHART.JS INDISPENSABLES
import { Chart, ChartConfiguration, ChartOptions, registerables } from 'chart.js';

import { addIcons } from 'ionicons';
import { business, documentText, hammer, warning, cameraOutline } from 'ionicons/icons';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, BaseChartDirective]
})
export class DashboardPage implements OnInit {
  
  stats: any = {};
  recentRapports: any[] = [];

  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    datasets: [
      { data: [5, 8, 12, 7, 10, 2, 0], label: 'Rapports', backgroundColor: '#1e3c72', borderRadius: 5 }
    ]
  };
  public barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } }
  };

  constructor(private api: ApiService) {
    // 👇 ENREGISTREMENT DES COMPOSANTS CHART.JS
    Chart.register(...registerables);
    
    addIcons({ business, documentText, hammer, warning, cameraOutline });
  }

  ngOnInit() {
    this.api.getStats().subscribe(data => {
      this.stats = data;
    });

    // Données simulées pour l'instant
    this.recentRapports = [
        { titre: 'Inspection Toiture', date_creation: new Date(), chantier_nom: 'Résidence Fleurs', niveau_urgence: 'Faible' },
        { titre: 'Fissure Mur Nord', date_creation: new Date(), chantier_nom: 'Gare du Nord', niveau_urgence: 'Critique' },
        { titre: 'Livraison Placo', date_creation: new Date(), chantier_nom: 'Villa Corse', niveau_urgence: 'Moyen' },
    ];
  }
}