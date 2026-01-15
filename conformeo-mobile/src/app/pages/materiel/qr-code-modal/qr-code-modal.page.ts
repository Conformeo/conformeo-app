import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular'; 

// 👇 J'ai supprimé la ligne "import { QRCodeModule }..." qui causait l'erreur

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
      <div class="passport-card" id="print-section">
        
        <div class="header">
          <h2>{{ mat.nom }}</h2>
          <p class="ref">{{ mat.ref_interne || mat.reference || 'Sans référence' }}</p>
        </div>

        <div class="qr-zone">
          <img [src]="qrUrl" alt="QR Code" class="qr-img" />
        </div>

        <div class="status-badge" 
             [style.borderColor]="color" 
             [style.color]="color">
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
    
    /* CSS POUR L'IMPRESSION UNIQUEMENT */
    @media print {
      body * { visibility: hidden; }
      #print-section, #print-section * { visibility: visible; }
      #print-section {
        position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none;
      }
      .actions, ion-header { display: none; }
    }
  `],
  standalone: true,
  imports: [CommonModule, IonicModule] // Plus besoin de QRCodeModule ici
})
export class QrCodeModalComponent implements OnInit {
  @Input() mat: any;

  qrUrl: string = '';
  color: string = '#7f8c8d';
  textStatus: string = 'INCONNU';
  nextVgpStr: string = 'Non définie';

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {
    // 1. Génération URL QR Code
    this.qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=CONFORME-${this.mat.id}`;

    // 2. Calcul Couleurs & Statut
    if(this.mat.statut_vgp === 'CONFORME') { this.color = '#2dd36f'; this.textStatus = 'VGP OK'; }
    if(this.mat.statut_vgp === 'NON CONFORME') { this.color = '#eb445a'; this.textStatus = 'INTERDIT'; }
    if(this.mat.statut_vgp === 'A PREVOIR') { this.color = '#ffc409'; this.textStatus = 'A PRÉVOIR'; }

    // 3. Calcul Dates
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

  print() {
    const content = document.getElementById('print-section')?.innerHTML;
    
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Etiquette ${this.mat.nom}</title>
            <style>
              body { font-family: sans-serif; text-align: center; padding: 20px; }
              .passport-card { border: 2px solid black; padding: 10px; border-radius: 10px; max-width: 300px; margin: 0 auto; }
              img { width: 150px; height: 150px; }
              .status-badge { border: 2px solid ${this.color}; color: ${this.color}; padding: 5px; border-radius: 5px; font-weight: bold; display: inline-block; margin: 10px 0; }
            </style>
          </head>
          <body>
            <div class="passport-card">
              ${content}
            </div>
            <script>
              setTimeout(() => { window.print(); window.close(); }, 500);
            </script>
          </body>
        </html>
      `);
      win.document.close();
    } else {
      alert("Impossible d'ouvrir la fenêtre d'impression. Vérifiez les pop-ups.");
    }
  }
}