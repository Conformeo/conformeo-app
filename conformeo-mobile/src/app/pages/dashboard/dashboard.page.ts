import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import { barChart, people, alertCircle, documentText, hammer, statsChart } from 'ionicons/icons';
import { ApiService } from '../../services/api';

// 👇 IMPORTS POUR LES GRAPHIQUES
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { Chart, registerables } from 'chart.js';

// Enregistrement des composants Chart.js
Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterLink, BaseChartDirective] // <--- Ajout BaseChartDirective
})
export class DashboardPage implements OnInit {
  
  // Données KPI
  stats = {
    total_chantiers: 0,
    actifs: 0,
    rapports: 0,
    alertes: 0
  };

  // --- CONFIGURATION DU GRAPHIQUE (Camembert) ---
  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
      },
    }
  };
  
  public pieChartType: ChartType = 'doughnut'; // Type "Beignet"
  
  public pieChartData: ChartData<'doughnut', number[], string | string[]> = {
    labels: [ 'Au Dépôt', 'Sur Chantier' ],
    datasets: [ {
      data: [ 0, 0 ], // Sera rempli par l'API
      backgroundColor: ['#2dd36f', '#ffc409'], // Vert (Ionic success) et Jaune (Ionic warning)
      hoverBackgroundColor: ['#28ba62', '#e0ac08'],
      borderWidth: 0
    } ]
  };

  constructor(private api: ApiService) {
    addIcons({ barChart, people, alertCircle, documentText, hammer, statsChart });
  }

  ngOnInit() {
    this.loadStats();
    this.loadMaterielStats();
  }

  loadStats() {
    this.api.getDashboardStats().subscribe(data => {
      this.stats = data;
    });
  }

  // On calcule les stats du matériel nous-mêmes pour le graphique
  loadMaterielStats() {
    this.api.getMateriels().subscribe(mats => {
      const auDepot = mats.filter(m => m.chantier_id === null).length;
      const surChantier = mats.filter(m => m.chantier_id !== null).length;

      // Mise à jour du graphique
      this.pieChartData = {
        labels: [ 'Au Dépôt', 'Sur Chantier' ],
        datasets: [ {
          data: [ auDepot, surChantier ],
          backgroundColor: ['#2dd36f', '#ffc409'],
          borderWidth: 0
        } ]
      };
    });
  }
}