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
    '#dbeafe', // Bleu Ciel
    '#dcfce7', // Vert Menthe
    '#ffedd5', // Pêche
    '#fee2e2', // Rose Pâle
    '#f3e8ff', // Lavande
    '#fef9c3', // Jaune Citron
    '#e0f2fe', // Bleu Glace
    '#fae8ff', // Mauve
    '#f3f4f6'  // Gris Perle
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
        // 1. Couleur Pastel
        const colorIndex = (c.id || index) % this.colors.length;
        const bgColor = this.colors[colorIndex];

        return {
          id: c.id?.toString(),
          title: `${c.client} - ${c.nom}`,
          start: c.date_debut || c.date_creation,
          end: c.date_fin || undefined,
          
          // 👇 LE STYLE PASTEL
          backgroundColor: bgColor,
          borderColor: 'transparent', // Plus joli sans bordure stricte
          textColor: '#1f2937',       // Texte Gris Foncé / Noir (Lisible)
          
          allDay: true,
          extendedProps: { adresse: c.adresse }
        };
      });

      this.calendarOptions = { ...this.calendarOptions, events: events };
    });
  }

  openChantier(id: string) {
    this.navCtrl.navigateForward(`/chantier/${id}`);
  }
}