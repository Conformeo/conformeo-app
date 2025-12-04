import { Component, Input, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ApiService, PIC } from 'src/app/services/api';
import { addIcons } from 'ionicons';
import { close, save, add, trash, checkmarkCircle, arrowUndo, shapes } from 'ionicons/icons';

interface Point { x: number; y: number; }

interface Element {
  id: number;
  type: 'icon' | 'polygon';
  // Pour Icon
  icon?: string;
  label?: string;
  x?: number;
  y?: number;
  // Pour Polygone
  points?: Point[];
  color?: string;
}

@Component({
  selector: 'app-pic-modal',
  template: `
    <ion-header>
      <ion-toolbar color="dark">
        <ion-buttons slot="start"><ion-button (click)="close()"><ion-icon name="close"></ion-icon></ion-button></ion-buttons>
        <ion-title>PIC Studio</ion-title>
        <ion-buttons slot="end"><ion-button (click)="save()" color="success"><ion-icon name="save"></ion-icon></ion-button></ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="no-scroll" style="--background: #222;">
      
      <div class="info-bar" *ngIf="mode === 'DRAWING'">
        <span>🔵 Placez les points ({{ currentPoints.length }})</span>
        <ion-button size="small" fill="clear" color="warning" (click)="undoLastPoint()">
          <ion-icon name="arrow-undo"></ion-icon>
        </ion-button>
        <ion-button size="small" color="success" (click)="finishPolygon()" [disabled]="currentPoints.length < 3">
          Terminer <ion-icon name="checkmark-circle"></ion-icon>
        </ion-button>
      </div>

      <div class="canvas-container">
        <canvas #canvas 
          (touchstart)="handleStart($event)" 
          (touchmove)="handleMove($event)" 
          (touchend)="handleEnd()"
          (mousedown)="handleStartMouse($event)" 
          (mousemove)="handleMoveMouse($event)" 
          (mouseup)="handleEnd()">
        </canvas>
        
        <div *ngIf="!backgroundImg" class="empty-placeholder" (click)="chooseBackground()">
          <ion-icon name="add" size="large"></ion-icon>
          <p>1. Charger le Plan de Masse</p>
        </div>
      </div>

      <div class="toolbar" *ngIf="backgroundImg && mode === 'IDLE'">
        
        <div class="tools-scroll">
          <div class="tool-group">
            <span class="group-label">Zones</span>
            <div class="sticker zone green" (click)="startDrawing('rgba(46, 204, 113, 0.5)')"></div>
            <div class="sticker zone yellow" (click)="startDrawing('rgba(241, 196, 15, 0.5)')"></div>
            <div class="sticker zone red" (click)="startDrawing('rgba(231, 76, 60, 0.5)')"></div>
          </div>

          <div class="separator"></div>

          <div class="tool-group">
            <span class="group-label">Éléments</span>
            <div class="sticker" (click)="addIcon('🏗️', 'Grue')">🏗️</div>
            <div class="sticker" (click)="addIcon('🏠', 'Base')">🏠</div>
            <div class="sticker" (click)="addIcon('⚡', 'Elec')">⚡</div>
            <div class="sticker" (click)="addIcon('🚧', 'Accès')">🚧</div>
            <div class="sticker" (click)="addIcon('♻️', 'Benne')">♻️</div>
          </div>
        </div>

        <div class="delete-action" *ngIf="selectedId" (click)="deleteSelected()">
          <ion-icon name="trash"></ion-icon> Supprimer
        </div>

      </div>

    </ion-content>
  `,
  styles: [`
    .no-scroll { --overflow: hidden; }
    
    .info-bar {
      position: absolute; top: 10px; left: 10px; right: 10px;
      background: rgba(0,0,0,0.8); color: white;
      padding: 5px 15px; border-radius: 20px;
      display: flex; justify-content: space-between; align-items: center;
      z-index: 100; font-size: 14px;
    }

    .canvas-container {
      width: 100%; height: 85%;
      background: #333; display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
    }

    .toolbar {
      height: 15%; background: #1a1a1a; display: flex; align-items: center;
      position: relative;
    }

    .tools-scroll {
      display: flex; align-items: center; overflow-x: auto; 
      padding: 0 10px; width: 100%; height: 100%;
    }

    .tool-group {
      display: flex; align-items: center; gap: 8px; margin-right: 10px;
    }
    .group-label {
      font-size: 10px; color: #666; transform: rotate(-90deg); 
      margin-right: -10px; white-space: nowrap;
    }

    .separator { width: 1px; height: 40px; background: #444; margin: 0 10px; }

    .sticker {
      font-size: 24px; background: #333; min-width: 45px; height: 45px;
      border-radius: 8px; display: flex; align-items: center; justify-content: center;
      color: white; border: 1px solid #444;
    }
    .sticker:active { transform: scale(0.9); }
    
    .sticker.zone { border: 2px solid white; }
    .sticker.green { background: rgba(46, 204, 113, 0.8); }
    .sticker.yellow { background: rgba(241, 196, 15, 0.8); }
    .sticker.red { background: rgba(231, 76, 60, 0.8); }

    .delete-action {
      position: absolute; right: 10px; top: -50px;
      background: #e74c3c; color: white;
      padding: 10px 20px; border-radius: 20px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      font-weight: bold; display: flex; align-items: center; gap: 5px;
    }
  `],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class PicModalComponent implements OnInit {
  @Input() chantierId!: number;
  @ViewChild('canvas', { static: false }) canvasEl!: ElementRef;
  
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;
  
  backgroundImg: HTMLImageElement | null = null;
  
  elements: Element[] = []; 
  
  // État
  mode: 'IDLE' | 'DRAWING' = 'IDLE';
  selectedId: number | null = null;
  
  // Pour le dessin de polygone
  currentPoints: Point[] = [];
  drawingColor: string = '';

  // Pour le déplacement
  isDragging = false;
  dragPointIndex: number | null = null; // Si on bouge un point précis
  
  constructor(private modalCtrl: ModalController, private api: ApiService) {
    addIcons({ close, save, add, trash, checkmarkCircle, arrowUndo, shapes });
  }

  ngOnInit() {
    this.api.getPIC(this.chantierId).subscribe(pic => {
      if (pic && pic.background_url) {
        this.elements = pic.elements_data || [];
        const img = new Image();
        img.src = pic.background_url;
        img.crossOrigin = "Anonymous";
        img.onload = () => {
          this.backgroundImg = img;
          this.initCanvas();
          this.draw();
        };
      }
    });
  }

  async chooseBackground() {
    const image = await Camera.getPhoto({
      quality: 80, allowEditing: false, resultType: CameraResultType.Uri, source: CameraSource.Prompt
    });
    if (image.webPath) {
      const img = new Image();
      img.src = image.webPath;
      img.onload = () => {
        this.backgroundImg = img;
        this.initCanvas();
        this.draw();
      };
    }
  }

  initCanvas() {
    if (!this.backgroundImg) return;
    this.canvas = this.canvasEl.nativeElement;
    const parent = this.canvas.parentElement!;
    
    // Calcul ratio pour remplir l'écran sans déformer
    const ratio = this.backgroundImg.width / this.backgroundImg.height;
    let w = parent.clientWidth;
    let h = w / ratio;
    
    if (h > parent.clientHeight) {
      h = parent.clientHeight;
      w = h * ratio;
    }

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
  }

  // --- GESTION ACTIONS ---

  addIcon(icon: string, label: string) {
    if (!this.backgroundImg) return;
    const cw = parseInt(this.canvas.style.width);
    const ch = parseInt(this.canvas.style.height);
    
    this.elements.push({
      id: Date.now(),
      type: 'icon',
      icon: icon,
      label: label,
      x: cw / 2,
      y: ch / 2
    });
    this.draw();
  }

  startDrawing(color: string) {
    this.mode = 'DRAWING';
    this.drawingColor = color;
    this.currentPoints = [];
    this.selectedId = null;
    this.draw();
  }

  undoLastPoint() {
    this.currentPoints.pop();
    this.draw();
  }

  finishPolygon() {
    if (this.currentPoints.length < 3) return;
    
    this.elements.push({
      id: Date.now(),
      type: 'polygon',
      points: [...this.currentPoints], // Copie des points
      color: this.drawingColor
    });
    
    this.mode = 'IDLE';
    this.currentPoints = [];
    this.draw();
  }

  deleteSelected() {
    if (this.selectedId) {
      this.elements = this.elements.filter(e => e.id !== this.selectedId);
      this.selectedId = null;
      this.draw();
    }
  }

  // --- MOTEUR DE DESSIN ---

  draw() {
    if (!this.ctx || !this.backgroundImg) return;
    
    const cw = parseInt(this.canvas.style.width);
    const ch = parseInt(this.canvas.style.height);
    this.ctx.clearRect(0, 0, cw, ch);
    
    // 1. Fond
    this.ctx.drawImage(this.backgroundImg, 0, 0, cw, ch);
    
    // 2. Elements existants
    for (let el of this.elements) {
      
      // POLYGONE
      if (el.type === 'polygon' && el.points) {
        this.ctx.beginPath();
        this.ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          this.ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        this.ctx.closePath();
        this.ctx.fillStyle = el.color || 'rgba(255,0,0,0.5)';
        this.ctx.fill();
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Si sélectionné, on dessine les poignées (points blancs)
        if (el.id === this.selectedId) {
           this.ctx.fillStyle = 'white';
           for (let p of el.points) {
             this.ctx.beginPath();
             this.ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); // Poignée
             this.ctx.fill();
             this.ctx.stroke();
           }
        }
      }

      // ICONE
      else if (el.type === 'icon' && el.x !== undefined && el.y !== undefined) {
        if (el.id === this.selectedId) {
           this.ctx.beginPath();
           this.ctx.arc(el.x, el.y, 25, 0, Math.PI*2);
           this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
           this.ctx.fill();
        }
        this.ctx.font = "30px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillStyle = "black";
        this.ctx.fillText(el.icon || '?', el.x, el.y);
      }
    }

    // 3. Dessin en cours (Ligne élastique)
    if (this.mode === 'DRAWING' && this.currentPoints.length > 0) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.currentPoints[0].x, this.currentPoints[0].y);
      for (let p of this.currentPoints) this.ctx.lineTo(p.x, p.y);
      
      this.ctx.strokeStyle = this.drawingColor;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      
      // Points
      this.ctx.fillStyle = 'white';
      for (let p of this.currentPoints) {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
        this.ctx.fill();
      }
    }
  }

  // --- GESTION TOUCH / MOUSE ---

  getPos(ev: any) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  handleStart(ev: any) {
    if(ev.cancelable) ev.preventDefault();
    const { x, y } = this.getPos(ev);
    
    // CAS 1 : EN COURS DE DESSIN -> On ajoute un point
    if (this.mode === 'DRAWING') {
      this.currentPoints.push({ x, y });
      this.draw();
      return;
    }

    // CAS 2 : MODE SELECTION -> On cherche ce qu'on touche
    this.isDragging = true;
    this.dragPointIndex = null;

    // A. Chercher si on touche une POIGNEE d'un polygone sélectionné
    if (this.selectedId) {
      const selEl = this.elements.find(e => e.id === this.selectedId);
      if (selEl && selEl.type === 'polygon' && selEl.points) {
        for (let i = 0; i < selEl.points.length; i++) {
          const p = selEl.points[i];
          if (Math.sqrt((x-p.x)**2 + (y-p.y)**2) < 15) { // Rayon 15px
            this.dragPointIndex = i; // On a attrapé un coin !
            return;
          }
        }
      }
    }

    // B. Chercher un élément (Icône ou Polygone)
    // On parcourt à l'envers pour prendre le dessus
    let found = false;
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      
      if (el.type === 'icon' && el.x && el.y) {
        if (Math.sqrt((x-el.x)**2 + (y-el.y)**2) < 30) {
          this.selectedId = el.id;
          found = true;
          break;
        }
      }
      
      // Détection simple pour polygone (centre approximatif)
      if (el.type === 'polygon' && el.points && el.points.length > 0) {
         // Pour simplifier, on teste si on est proche d'un des points
         // Dans une V3, on ferait un "Point in Polygon" algorithm
         const proche = el.points.some(p => Math.sqrt((x-p.x)**2 + (y-p.y)**2) < 40);
         if (proche) {
            this.selectedId = el.id;
            found = true;
            break;
         }
      }
    }

    if (!found) this.selectedId = null;
    this.draw();
  }

  handleMove(ev: any) {
    if(ev.cancelable) ev.preventDefault();
    if (!this.isDragging) return;
    const { x, y } = this.getPos(ev);
    
    if (this.selectedId) {
      const el = this.elements.find(e => e.id === this.selectedId);
      
      if (el) {
        // 1. Déplacer un POINT spécifique (Polygone)
        if (el.type === 'polygon' && this.dragPointIndex !== null && el.points) {
           el.points[this.dragPointIndex] = { x, y };
        }
        // 2. Déplacer tout l'ICON
        else if (el.type === 'icon' && el.x !== undefined) {
           el.x = x;
           el.y = y;
        }
        // 3. (Optionnel) Déplacer tout le polygone (complexe, on laisse pour V3)
      }
      this.draw();
    }
  }

  handleEnd() {
    this.isDragging = false;
    this.dragPointIndex = null;
  }

  // Wrappers Souris
  handleStartMouse(ev: any) { this.handleStart(ev); }
  handleMoveMouse(ev: any) { this.handleMove(ev); }

  // --- SAUVEGARDE ---
  async save() {
    this.selectedId = null;
    this.draw();
    
    this.canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        this.api.uploadPhoto(blob).subscribe({
            next: (res) => {
                const finalUrl = res.url;
                const picData: PIC = {
                    chantier_id: this.chantierId,
                    background_url: finalUrl, 
                    final_url: finalUrl,
                    elements_data: this.elements
                };

                this.api.savePIC(picData).subscribe(() => {
                    alert("PIC sauvegardé !");
                    this.api.needsRefresh = true;
                    this.modalCtrl.dismiss();
                });
            },
            error: () => alert("Erreur Upload")
        });
    });
  }

  close() { this.modalCtrl.dismiss(); }
}