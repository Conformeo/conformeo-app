import { Component, Input, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, LoadingController, ToastController, ActionSheetController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ApiService } from 'src/app/services/api'; // Vérifiez le chemin
import { addIcons } from 'ionicons';
import { close, save, add, trash, checkmarkCircle, arrowUndo, shapes, move, camera, image } from 'ionicons/icons';

interface Point { x: number; y: number; }

export interface PicElement {
  id: number;
  type: 'icon' | 'polygon';
  icon?: string;
  label?: string;
  x?: number;
  y?: number;
  points?: Point[];
  color?: string;
}

@Component({
  selector: 'app-pic-modal',
  template: `
    <ion-header>
      <ion-toolbar color="light">
        <ion-buttons slot="start">
          <ion-button (click)="close()" color="dark"><ion-icon name="close"></ion-icon></ion-button>
        </ion-buttons>
        <ion-title>Plan d'Installation</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="save()" color="success" [disabled]="isSaving">
            <ion-spinner *ngIf="isSaving" name="crescent"></ion-spinner>
            <ion-icon *ngIf="!isSaving" name="save"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="no-scroll" style="--background: #222;">
      
      <div class="info-bar" *ngIf="mode === 'DRAWING'">
        <span>🔵 Points : {{ currentPoints.length }}</span>
        <div style="display:flex; gap:10px">
          <ion-button size="small" fill="clear" color="warning" (click)="undoLastPoint()">
            <ion-icon name="arrow-undo"></ion-icon>
          </ion-button>
          <ion-button size="small" color="success" (click)="finishPolygon()" [disabled]="currentPoints.length < 3">
            OK <ion-icon name="checkmark-circle"></ion-icon>
          </ion-button>
        </div>
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
        
        <div *ngIf="!backgroundImg" class="empty-placeholder" (click)="presentPhotoActionSheet()">
          <div class="dashed-box">
            <ion-icon name="add" size="large"></ion-icon>
            <p>Charger le Plan de Masse</p>
          </div>
        </div>
      </div>

      <div class="toolbar" *ngIf="backgroundImg && mode === 'IDLE'">
        
        <div class="tools-scroll">
          
          <div class="tool-group">
            <span class="group-label">Zones</span>
            <div class="sticker zone green" (click)="startDrawing('rgba(46, 204, 113, 0.5)')"></div>
            <div class="sticker zone yellow" (click)="startDrawing('rgba(241, 196, 15, 0.5)')"></div>
            <div class="sticker zone red" (click)="startDrawing('rgba(231, 76, 60, 0.5)')"></div>
            <div class="sticker zone blue" (click)="startDrawing('rgba(52, 152, 219, 0.5)')"></div>
            <div class="sticker zone orange" (click)="startDrawing('rgba(230, 126, 34, 0.5)')"></div>
            <div class="sticker zone purple" (click)="startDrawing('rgba(155, 89, 182, 0.5)')"></div>
            <div class="sticker zone cyan" (click)="startDrawing('rgba(26, 188, 156, 0.5)')"></div>
            <div class="sticker zone pink" (click)="startDrawing('rgba(255, 105, 180, 0.5)')"></div>
            <div class="sticker zone grey" (click)="startDrawing('rgba(149, 165, 166, 0.5)')"></div>
          </div>

          <div class="separator"></div>

          <div class="tool-group">
            <span class="group-label">Éléments</span>
            <div class="sticker" (click)="addIcon('🏗️')">🏗️</div>
            <div class="sticker" (click)="addIcon('🏠')">🏠</div>
            <div class="sticker" (click)="addIcon('⚡')">⚡</div>
            <div class="sticker" (click)="addIcon('💧')">💧</div>
            <div class="sticker" (click)="addIcon('🚽')">🚽</div>
            <div class="sticker" (click)="addIcon('🚧')">🚧</div>
            <div class="sticker" (click)="addIcon('♻️')">♻️</div>
            <div class="sticker" (click)="addIcon('🔥')">🔥</div>
            <div class="sticker" (click)="addIcon('🅿️')">🅿️</div>
            <div class="sticker" (click)="addIcon('⛔')">⛔</div>
            <div class="sticker" (click)="addIcon('⬇️')">⬇️</div>
          </div>
        </div>

        <div class="delete-action" *ngIf="selectedId" (click)="deleteSelected()">
          <ion-icon name="trash"></ion-icon>
        </div>

      </div>
    </ion-content>
  `,
  styles: [`
    .no-scroll { --overflow: hidden; }
    
    .info-bar {
      position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.85); color: white;
      padding: 5px 15px; border-radius: 25px;
      display: flex; gap: 15px; align-items: center;
      z-index: 100; font-size: 14px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    }

    .canvas-container {
      width: 100%; height: 85%;
      background: #333; display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
    }

    .empty-placeholder {
      width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
      color: #888; cursor: pointer;
    }
    .dashed-box {
      border: 2px dashed #666; padding: 40px; border-radius: 20px; text-align: center;
    }

    .toolbar {
      height: 15%; background: #1a1a1a; display: flex; align-items: center;
      position: relative; border-top: 1px solid #333;
    }

    .tools-scroll {
      display: flex; align-items: center; overflow-x: auto; 
      padding: 0 10px; width: 100%; height: 100%;
    }

    .tool-group {
      display: flex; align-items: center; gap: 8px; margin-right: 15px;
    }
    .group-label {
      font-size: 9px; color: #666; writing-mode: vertical-rl; transform: rotate(180deg);
      text-transform: uppercase; font-weight: bold; letter-spacing: 1px;
    }

    .separator { width: 1px; height: 40px; background: #444; margin: 0 5px; }

    .sticker {
      font-size: 24px; background: #2a2a2a; min-width: 45px; height: 45px;
      border-radius: 10px; display: flex; align-items: center; justify-content: center;
      color: white; border: 1px solid #444; box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    .sticker:active { transform: scale(0.9); background: #444; }
    
    .sticker.zone { border: 2px solid #555; }
    
    /* --- COULEURS --- */
    .sticker.green { background: #2ecc71; }
    .sticker.yellow { background: #f1c40f; }
    .sticker.red { background: #e74c3c; }
    .sticker.blue { background: #3498db; }
    .sticker.orange { background: #e67e22; }
    .sticker.purple { background: #9b59b6; }
    .sticker.cyan { background: #1abc9c; }
    .sticker.pink { background: #ff69b4; }
    .sticker.grey { background: #95a5a6; }

    .delete-action {
      position: absolute; right: 20px; top: -60px;
      background: #e74c3c; color: white;
      width: 50px; height: 50px; border-radius: 50%;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center; font-size: 24px;
      animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes popIn { from { transform: scale(0); } to { transform: scale(1); } }
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
  
  elements: PicElement[] = []; 
  
  mode: 'IDLE' | 'DRAWING' = 'IDLE';
  selectedId: number | null = null;
  
  currentPoints: Point[] = [];
  drawingColor: string = '';

  isDragging = false;
  dragPointIndex: number | null = null; 
  dragStartPos: Point = {x:0, y:0};
  
  isSaving = false;

  constructor(
    private modalCtrl: ModalController, 
    public api: ApiService, 
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private actionSheetCtrl: ActionSheetController
  ) {
    addIcons({ close, save, add, trash, checkmarkCircle, arrowUndo, shapes, move, camera, image });
  }

  ngOnInit() {
    this.api.http.get(`${this.api.apiUrl}/chantiers/${this.chantierId}/pic`).subscribe((pic: any) => {
      if (pic && pic.background_url) {
        if (typeof pic.elements_data === 'string') {
             try { this.elements = JSON.parse(pic.elements_data); } catch(e) { this.elements = []; }
        } else {
             this.elements = pic.elements_data || [];
        }

        const img = new Image();
        img.crossOrigin = "Anonymous"; 
        img.src = pic.background_url;
        img.onload = () => {
          this.backgroundImg = img;
          setTimeout(() => { this.initCanvas(); this.draw(); }, 150);
        };
      }
    });
  }

  async presentPhotoActionSheet() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Charger un plan',
      buttons: [
        { text: 'Prendre une photo', icon: 'camera', handler: () => { this.getPhoto(CameraSource.Camera); } },
        { text: 'Choisir depuis la galerie', icon: 'image', handler: () => { this.getPhoto(CameraSource.Photos); } },
        { text: 'Annuler', icon: 'close', role: 'cancel' }
      ]
    });
    await actionSheet.present();
  }

  async getPhoto(source: CameraSource) {
    try {
      const image = await Camera.getPhoto({
        quality: 90, allowEditing: false, resultType: CameraResultType.Uri, source: source
      });
      if (image.webPath) {
        const img = new Image();
        img.src = image.webPath;
        img.onload = () => {
          this.backgroundImg = img;
          this.elements = []; 
          this.initCanvas();
          this.draw();
        };
      }
    } catch (e) {}
  }

  initCanvas() {
    if (!this.backgroundImg) return;
    this.canvas = this.canvasEl.nativeElement;
    const parent = this.canvas.parentElement!;
    
    const ratio = this.backgroundImg.width / this.backgroundImg.height;
    let w = parent.clientWidth;
    let h = w / ratio;
    
    if (h > parent.clientHeight) { h = parent.clientHeight; w = h * ratio; }

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
  }

  addIcon(icon: string) {
    if (!this.backgroundImg) return;
    const cw = parseInt(this.canvas.style.width);
    const ch = parseInt(this.canvas.style.height);
    this.elements.push({ id: Date.now(), type: 'icon', icon: icon, x: cw / 2, y: ch / 2 });
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
    this.elements.push({ id: Date.now(), type: 'polygon', points: [...this.currentPoints], color: this.drawingColor });
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

  // --- MOTEUR DE DESSIN (Mise à jour pour gestion des calques) ---

  draw() {
    if (!this.ctx || !this.backgroundImg) return;
    const cw = parseInt(this.canvas.style.width);
    const ch = parseInt(this.canvas.style.height);
    
    // 1. Nettoyage
    this.ctx.clearRect(0, 0, cw, ch);
    
    // 2. Fond (Plan de masse)
    this.ctx.drawImage(this.backgroundImg, 0, 0, cw, ch);
    
    // 3. CALQUE 1 : Les ZONES (Polygones)
    // On dessine d'abord toutes les formes colorées pour qu'elles soient en dessous
    for (let el of this.elements) {
      if (el.type === 'polygon' && el.points) {
        const isSelected = el.id === this.selectedId;

        this.ctx.beginPath();
        this.ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) this.ctx.lineTo(el.points[i].x, el.points[i].y);
        this.ctx.closePath();
        
        // Couleur de remplissage
        this.ctx.fillStyle = el.color || 'rgba(255,0,0,0.5)';
        this.ctx.fill();
        
        // Bordure
        this.ctx.strokeStyle = isSelected ? 'white' : 'rgba(255,255,255,0.5)';
        this.ctx.lineWidth = isSelected ? 3 : 1;
        this.ctx.stroke();

        // Poignées si sélectionné
        if (isSelected) {
           this.ctx.fillStyle = 'white';
           for (let p of el.points) {
             this.ctx.beginPath(); 
             this.ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); 
             this.ctx.fill(); 
             this.ctx.stroke();
           }
        }
      }
    }

    // 4. CALQUE 2 : Les ICONES
    // On dessine ensuite les icônes pour qu'elles apparaissent TOUJOURS au-dessus des zones
    for (let el of this.elements) {
      if (el.type === 'icon' && el.x !== undefined && el.y !== undefined) {
        const isSelected = el.id === this.selectedId;

        // Cercle de fond pour l'icône (si sélectionné)
        if (isSelected) {
           this.ctx.beginPath(); 
           this.ctx.arc(el.x!, el.y!, 25, 0, Math.PI*2);
           this.ctx.fillStyle = 'rgba(255,255,255,0.4)'; 
           this.ctx.fill();
           this.ctx.lineWidth = 2; 
           this.ctx.strokeStyle = 'white'; 
           this.ctx.stroke();
        }

        // Dessin de l'émoji
        this.ctx.font = "35px Arial"; 
        this.ctx.textAlign = "center"; 
        this.ctx.textBaseline = "middle";
        this.ctx.fillStyle = "black"; // Force la couleur de l'emoji si besoin
        this.ctx.fillText(el.icon || '?', el.x!, el.y!);
      }
    }

    // 5. CALQUE 3 : Dessin en cours (Le tracé que l'utilisateur est en train de faire)
    if (this.mode === 'DRAWING' && this.currentPoints.length > 0) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.currentPoints[0].x, this.currentPoints[0].y);
      for (let p of this.currentPoints) this.ctx.lineTo(p.x, p.y);
      
      this.ctx.strokeStyle = this.drawingColor; 
      this.ctx.lineWidth = 2; 
      this.ctx.stroke();
      
      // Points guides
      this.ctx.fillStyle = 'white';
      for (let p of this.currentPoints) {
        this.ctx.beginPath(); 
        this.ctx.arc(p.x, p.y, 4, 0, Math.PI*2); 
        this.ctx.fill();
      }
    }
  }

  getPos(ev: any) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  isPointInPolygon(p: Point, points: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x, yi = points[i].y;
        const xj = points[j].x, yj = points[j].y;
        const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
  }

  handleStart(ev: any) {
    if(ev.cancelable) ev.preventDefault();
    const { x, y } = this.getPos(ev);
    
    if (this.mode === 'DRAWING') {
      this.currentPoints.push({ x, y });
      this.draw();
      return;
    }

    this.isDragging = true;
    this.dragPointIndex = null;
    this.dragStartPos = { x, y };

    if (this.selectedId) {
      const selEl = this.elements.find(e => e.id === this.selectedId);
      if (selEl && selEl.type === 'polygon' && selEl.points) {
        for (let i = 0; i < selEl.points.length; i++) {
          const p = selEl.points[i];
          if (Math.sqrt((x-p.x)**2 + (y-p.y)**2) < 20) {
            this.dragPointIndex = i; return;
          }
        }
      }
    }

    let foundId = null;
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      if (el.type === 'icon' && el.x !== undefined && el.y !== undefined) {
        if (Math.sqrt((x-el.x!)**2 + (y-el.y!)**2) < 30) { foundId = el.id; break; }
      }
      if (el.type === 'polygon' && el.points) {
        if (this.isPointInPolygon({x,y}, el.points)) { foundId = el.id; break; }
      }
    }
    this.selectedId = foundId;
    this.draw();
  }

  handleMove(ev: any) {
    if(ev.cancelable) ev.preventDefault();
    if (!this.isDragging) return;
    const { x, y } = this.getPos(ev);
    
    if (this.selectedId) {
      const el = this.elements.find(e => e.id === this.selectedId);
      if (!el) return;

      if (el.type === 'polygon' && this.dragPointIndex !== null && el.points) {
         el.points[this.dragPointIndex] = { x, y };
      } else {
         const dx = x - this.dragStartPos.x;
         const dy = y - this.dragStartPos.y;
         if (el.type === 'icon' && el.x !== undefined && el.y !== undefined) { 
            el.x += dx; el.y += dy; 
         }
         else if (el.type === 'polygon' && el.points) { 
            el.points.forEach(p => { p.x += dx; p.y += dy; }); 
         }
         this.dragStartPos = { x, y };
      }
      this.draw();
    }
  }

  handleEnd() {
    this.isDragging = false;
    this.dragPointIndex = null;
  }
  
  handleStartMouse(ev: any) { this.handleStart(ev); }
  handleMoveMouse(ev: any) { this.handleMove(ev); }

  async save() {
    this.selectedId = null;
    this.draw();
    this.isSaving = true;

    this.canvas.toBlob(async (blob) => {
        if (!blob) { this.isSaving = false; return; }
        
        const file = new File([blob], "pic_final.png", { type: "image/png" });
        const formData = new FormData();
        formData.append("file", file);
        
        this.api.http.post<any>(`${this.api.apiUrl}/upload`, formData).subscribe({
            next: (res) => {
                const finalUrl = res.url;
                const picData = {
                    chantier_id: this.chantierId,
                    background_url: this.backgroundImg?.src || finalUrl, 
                    final_url: finalUrl,
                    elements_data: this.elements 
                };

                this.api.http.post(`${this.api.apiUrl}/chantiers/${this.chantierId}/pic`, picData).subscribe({
                  next: async () => {
                    this.isSaving = false;
                    const t = await this.toastCtrl.create({ message: 'Plan sauvegardé ! 💾', duration: 2000, color: 'success' });
                    t.present();
                    this.modalCtrl.dismiss(true);
                  },
                  error: async () => { 
                    this.isSaving = false; 
                    const t = await this.toastCtrl.create({ message: 'Erreur sauvegarde API', duration: 3000, color: 'danger' });
                    t.present();
                  }
                });
            },
            error: () => { 
              this.isSaving = false; 
              alert("Erreur Upload Image");
            }
        });
    });
  }

  close() { this.modalCtrl.dismiss(); }
}