import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ApiService } from '../../services/api';
import { addIcons } from 'ionicons';
import { barChart, people, alertCircle, documentText } from 'ionicons/icons';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterLink]
})
export class DashboardPage implements OnInit {
  stats = {
    total_chantiers: 0,
    actifs: 0,
    rapports: 0,
    alertes: 0
  };

  constructor(private api: ApiService) {
    addIcons({ barChart, people, alertCircle, documentText });
  }

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.api.getDashboardStats().subscribe(data => {
      this.stats = data;
    });
  }
}