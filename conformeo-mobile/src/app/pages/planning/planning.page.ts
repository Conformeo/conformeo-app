import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
import { ApiService, Chantier } from 'src/app/services/api';
import { addIcons } from 'ionicons';
import { calendarOutline, add, filter } from 'ionicons/icons';

// 👇 IMPORTS FULLCALENDAR
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr'; // Pour l'avoir en Français !

@Component({
  selector: 'app-planning',
  templateUrl: './planning.page.html',
  styleUrls: ['./planning.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FullCalendarModule]
})
export class PlanningPage implements OnInit {

  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin, interactionPlugin],
    locale: frLocale, // Français
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,dayGridWeek'
    },
    weekends: false, // On cache les weekends pour faire "Pro"
    events: [], // On va le remplir
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
      // Transformation des Chantiers en Événements Calendrier
      const events = chantiers.map(c => ({
        id: c.id?.toString(),
        title: c.nom,
        start: c.date_debut || c.date_creation, // Fallback si pas de date
        end: c.date_fin || undefined,
        // Couleur selon le statut (simulé ici, à améliorer)
        backgroundColor: c.est_actif ? '#1e3c72' : '#2dd36f',
        borderColor: c.est_actif ? '#1e3c72' : '#2dd36f',
        allDay: true
      }));

      this.calendarOptions = { ...this.calendarOptions, events: events };
    });
  }

  openChantier(id: string) {
    this.navCtrl.navigateForward(`/chantier/${id}`);
  }
}