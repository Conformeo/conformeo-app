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
      console.log("Données Dashboard reçues :", data);
      
      // 1. Mise à jour des KPIs
      // Attention : mon API renvoie maintenant un objet imbriqué "kpis"
      // Si votre HTML utilise 'stats.actifs', il faut mapper
      this.stats = data.kpis; 

      // 2. Mise à jour de la liste récente
      this.recentRapports = data.recents;

      // 3. Mise à jour du Graphique
      this.updateChart(data.chart.labels, data.chart.values);
    });
  }

  updateChart(labels: string[], values: number[]) {
    this.barChartData = {
      labels: labels,
      datasets: [
        { 
          data: values, 
          label: 'Rapports / Jour', 
          backgroundColor: '#1e3c72', 
          borderRadius: 5,
          hoverBackgroundColor: '#2a5298'
        }
      ]
    };
    // Astuce : Pour forcer le rafraîchissement visuel du chart s'il ne bouge pas
    // on peut parfois avoir besoin de réassigner l'option ou trigger un change detection,
    // mais avec ng2-charts, réassigner 'barChartData' suffit souvent.
  }
}