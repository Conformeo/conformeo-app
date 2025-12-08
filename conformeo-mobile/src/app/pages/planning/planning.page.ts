import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
import { ApiService } from 'src/app/services/api';
import { addIcons } from 'ionicons';
import { calendarOutline, add, filter } from 'ionicons/icons';

import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';

@Component({
  selector: 'app-planning',
  templateUrl: './planning.page.html',
  styleUrls: ['./planning.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FullCalendarModule]
})
export class PlanningPage implements OnInit {

  // Une palette de couleurs "Modernes" (pas fluo)
  private colors = [
    '#3498db', // Bleu
    '#e67e22', // Orange
    '#2ecc71', // Vert
    '#9b59b6', // Violet
    '#1abc9c', // Turquoise
    '#e74c3c', // Rouge doux
    '#34495e', // Bleu Gris
    '#f1c40f', // Jaune Moutarde
    '#d35400', // Rouille
    '#7f8c8d'  // Gris
  ];

  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin, interactionPlugin],
    locale: frLocale,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth' // On garde simple sur mobile
    },
    weekends: false,
    eventDisplay: 'block', // Force l'affichage en bloc coloré
    events: [],
    eventClick: (info) => this.openChantier(info.event.id)
  };

  constructor(private api: ApiService, private navCtrl: NavController) {
    addIcons({ calendarOutline, add, filter });
  }

  ngOnInit() {
    this.loadEvents();
  }

  loadEvents() {
    this.api.getChantiers().subscribe(chantiers => {
      
      const events = chantiers.map((c, index) => {
        // 1. On attribue une couleur unique basée sur l'index ou l'ID
        const colorIndex = (c.id || index) % this.colors.length;
        const color = this.colors[colorIndex];

        return {
          id: c.id?.toString(),
          // 2. Titre plus complet : "CLIENT - Chantier"
          title: `${c.client} - ${c.nom}`,
          start: c.date_debut || c.date_creation,
          end: c.date_fin || undefined,
          backgroundColor: color,
          borderColor: color,
          textColor: '#ffffff', // Texte blanc pour le contraste
          allDay: true,
          // 3. Propriétés étendues pour le futur (tooltip)
          extendedProps: {
            adresse: c.adresse
          }
        };
      });

      this.calendarOptions = { ...this.calendarOptions, events: events };
    });
  }

  openChantier(id: string) {
    this.navCtrl.navigateForward(`/chantier/${id}`);
  }
}