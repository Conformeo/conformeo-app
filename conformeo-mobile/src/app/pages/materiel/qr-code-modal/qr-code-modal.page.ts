import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, Platform } from '@ionic/angular'; 
// 👇 LE BON IMPORT
import { Printer } from '@bcyesil/capacitor-plugin-printer'; 

@Component({
  selector: 'app-qr-code-modal',
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Passeport Sécurité</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()">Fermer</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="passport-card">
        <div class="header">
          <h2>{{ mat.nom }}</h2>
          <p class="ref">{{ mat.ref_interne || mat.reference || 'Sans référence' }}</p>
        </div>
        <div class="qr-zone">
          <img [src]="qrUrl" alt="QR Code" class="qr-img" />
        </div>
        <div class="status-badge" [style.borderColor]="color" [style.color]="color">
          {{ textStatus }}
        </div>
        <div class="dates">
          <p>Dernière VGP : <strong>{{ formatDate(mat.date_derniere_vgp) }}</strong></p>
          <p>Validité jusqu'au : <strong>{{ nextVgpStr }}</strong></p>
        </div>
      </div>

      <div class="actions">
        <ion-button expand="block" (click)="print()" color="secondary">
          <ion-icon name="print-outline" slot="start"></ion-icon>
          Imprimer l'étiquette
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    .passport-card {
      background: white;
      border: 1px solid #ddd;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin-bottom: 20px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.05);
    }
    .header h2 { margin: 0; font-size: 1.4rem; color: #333; }
    .header .ref { color: #666; margin: 5px 0 15px; font-family: monospace; font-size: 1.1rem;}
    .qr-img { width: 180px; height: 180px; display: block; margin: 0 auto 15px; }
    .status-badge {
      display: inline-block; padding: 8px 16px; border: 3px solid #ccc; 
      border-radius: 8px; font-weight: 800; font-size: 1.2rem; text-transform: uppercase;
      margin-bottom: 15px;
    }
    .dates p { margin: 5px 0; font-size: 0.9rem; color: #444; }
  `],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class QrCodeModalComponent implements OnInit {
  @Input() mat: any;

  qrUrl: string = '';
  color: string = '#7f8c8d';
  textStatus: string = 'INCONNU';
  nextVgpStr: string = 'Non définie';

  constructor(
    private modalCtrl: ModalController, 
    private platform: Platform 
  ) {}

  ngOnInit() {
    this.qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=CONFORME-${this.mat.id}`;

    if(this.mat.statut_vgp === 'CONFORME') { this.color = '#2dd36f'; this.textStatus = 'VGP OK'; }
    if(this.mat.statut_vgp === 'NON CONFORME') { this.color = '#eb445a'; this.textStatus = 'INTERDIT'; }
    if(this.mat.statut_vgp === 'A PREVOIR') { this.color = '#ffc409'; this.textStatus = 'A PRÉVOIR'; }

    if (this.mat.date_derniere_vgp) {
      const d = new Date(this.mat.date_derniere_vgp);
      d.setFullYear(d.getFullYear() + 1);
      this.nextVgpStr = d.toLocaleDateString('fr-FR');
    }
  }

  formatDate(d: string) {
    if (!d) return '--/--/----';
    return new Date(d).toLocaleDateString('fr-FR');
  }

  close() {
    this.modalCtrl.dismiss();
  }

  async print() {
    // Construction du HTML pour l'impression
    // Note : le plugin @bcyesil gère très bien le HTML string
    const content = `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 10px; border: 2px solid black; border-radius: 10px; max-width: 300px; margin: 0 auto;">
        <h1 style="font-size: 22px; margin: 5px 0;">${this.mat.nom}</h1>
        <h2 style="font-size: 16px; color: #555; margin-bottom: 15px;">Ref: ${this.mat.ref_interne || this.mat.reference || '---'}</h2>
        
        <img src="${this.qrUrl}" style="width: 150px; height: 150px;" />
        
        <br>
        <div style="margin-top: 15px; border: 3px solid ${this.color}; color: ${this.color}; padding: 8px 15px; border-radius: 8px; font-weight: bold; font-size: 18px; display: inline-block;">
          ${this.textStatus}
        </div>
        
        <div style="font-size: 12px; margin-top: 15px; color: #333;">
          Validité jusqu'au : <strong>${this.nextVgpStr}</strong>
        </div>
      </div>
    `;

    try {
      if (this.platform.is('capacitor')) {
        // --- MODE MOBILE (PLUGIN @bcyesil) ---
        await Printer.print({
          content: content,
          name: `Etiquette-${this.mat.nom}`,
          orientation: 'portrait'
        });
      } else {
        // --- MODE WEB (PC) - Fallback ---
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(`<html><body>${content}<script>setTimeout(()=>{window.print();window.close()},500)</script></body></html>`);
          win.document.close();
        }
      }
    } catch (e) {
      console.error('Erreur impression', e);
      alert("Erreur lors de l'impression : " + JSON.stringify(e));
    }
  }
}