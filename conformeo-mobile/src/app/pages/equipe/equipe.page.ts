import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { ApiService } from 'src/app/services/api.service';
import { AddMemberModalComponent } from './add-member-modal/add-member-modal.component';
import { addIcons } from 'ionicons';
import { personAddOutline, personCircleOutline, mailOutline, briefcaseOutline } from 'ionicons/icons';

@Component({
  selector: 'app-equipe',
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar style="--background: #f8f9fa;">
        <ion-buttons slot="start"><ion-menu-button color="dark"></ion-menu-button></ion-buttons>
        <ion-title style="color: #1a1a1a; font-weight: 800;">Mon Équipe</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="addMember()" color="primary" fill="solid">
            <ion-icon name="person-add-outline" slot="start"></ion-icon> Ajouter
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content style="--background: #f8f9fa;">
      <div class="team-grid">
        <div class="team-card" *ngFor="let user of team">
          <div class="avatar-circle">
            <ion-icon name="person-circle-outline"></ion-icon>
          </div>
          <h3>{{ user.email.split('@')[0] }}</h3> <div class="info-row">
            <ion-icon name="briefcase-outline"></ion-icon>
            <span class="badge">{{ user.role }}</span>
          </div>
          
          <div class="info-row email">
            <ion-icon name="mail-outline"></ion-icon>
            <span>{{ user.email }}</span>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .team-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; padding: 20px;
    }
    .team-card {
      background: white; border-radius: 16px; padding: 30px 20px; text-align: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.05); transition: transform 0.2s;
      &:hover { transform: translateY(-5px); }
    }
    .avatar-circle {
      font-size: 64px; color: #ccc; margin-bottom: 10px;
    }
    h3 { margin: 0 0 15px; font-size: 18px; font-weight: 700; color: #333; text-transform: capitalize; }
    
    .info-row {
      display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px; color: #666; font-size: 14px;
    }
    .email { font-size: 12px; color: #888; }
    
    .badge {
      background: #e3f2fd; color: #1565c0; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase;
    }
  `],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class EquipePage implements OnInit {
  team: any[] = [];

  constructor(private api: ApiService, private modalCtrl: ModalController) {
    addIcons({ personAddOutline, personCircleOutline, mailOutline, briefcaseOutline });
  }

  ngOnInit() {
    this.loadTeam();
  }

  loadTeam() {
    this.api.getTeam().subscribe(data => this.team = data);
  }

  async addMember() {
    const modal = await this.modalCtrl.create({
      component: AddMemberModalComponent
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') this.loadTeam();
  }
}