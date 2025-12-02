import { Component, Input, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, Platform } from '@ionic/angular'; // Ajout Platform
import { addIcons } from 'ionicons';
import { close, checkmark, trash, colorPalette } from 'ionicons/icons';

@Component({
  selector: 'app-annotation-modal',
  template: `
    <ion-header>
      <ion-toolbar color="dark">
        <ion-buttons slot="start">
          <ion-button (click)="cancel()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>Annoter</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="save()" color="success" strong>
            <ion-icon name="checkmark"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="no-scroll" style="--background: #000;">
      
      <div class="canvas-wrapper">
        <img [src]="photoWebPath" #imageEl (load)="initCanvas()" class="background-image" />
        
        <canvas #canvas 
          (touchstart)="startDrawing($event)" 
          (touchmove)="moved($event)" 
          (touchend)="endDrawing()"
          (mousedown)="startDrawingMouse($event)" 
          (mousemove)="movedMouse($event)" 
          (mouseup)="endDrawing()">
        </canvas>
      </div>

      <div class="toolbar-annotation">
        <ion-button fill="clear" (click)="setColor('#ff0000')" [class.active]="currentColor==='#ff0000'">
          <div class="color-dot" style="background: red;"></div>
        </ion-button>
        <ion-button fill="clear" (click)="setColor('#ffff00')" [class.active]="currentColor==='#ffff00'">
          <div class="color-dot" style="background: yellow;"></div>
        </ion-button>
        <ion-button fill="clear" (click)="setColor('#ffffff')" [class.active]="currentColor==='#ffffff'">
          <div class="color-dot" style="background: white;"></div>
        </ion-button>
        
        <div class="spacer"></div>
        
        <ion-button fill="clear" color="danger" (click)="clearCanvas()">
          <ion-icon name="trash"></ion-icon>
        </ion-button>
      </div>

    </ion-content>
  `,
  styles: [`
    .no-scroll { --overflow: hidden; }
    
    .canvas-wrapper {
      position: relative;
      width: 100%;
      height: 85%;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #111;
      overflow: hidden;
    }

    .background-image {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      pointer-events: none; /* Important ! */
      display: block;
    }

    canvas {
      position: absolute;
      touch-action: none;
      z-index: 10; /* Le canvas doit être AU DESSUS */
    }

    .toolbar-annotation {
      height: 15%;
      background: #222;
      display: flex;
      align-items: center;
      padding: 0 20px;
      justify-content: space-around;
    }
    .color-dot { width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; }
    .active .color-dot { border-color: white; transform: scale(1.2); }
    .spacer { flex: 1; }
  `],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class AnnotationModalComponent {
  @Input() photoWebPath!: string;
  @ViewChild('canvas', { static: false }) canvasEl!: ElementRef;
  @ViewChild('imageEl', { static: false }) imageEl!: ElementRef;

  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;
  currentColor = '#ff0000';
  isDrawing = false;
  lastX = 0; lastY = 0;

  constructor(private modalCtrl: ModalController) {
    addIcons({ close, checkmark, trash, colorPalette });
  }

  // --- INITIALISATION ---
  initCanvas() {
    // Petit délai pour être sûr que l'image est bien positionnée par le CSS
    setTimeout(() => {
        const img = this.imageEl.nativeElement;
        this.canvas = this.canvasEl.nativeElement;

        // 1. Dimensions affichées à l'écran
        const renderWidth = img.offsetWidth;
        const renderHeight = img.offsetHeight;

        // 2. Dimensions internes (Haute Qualité)
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = renderWidth * dpr;
        this.canvas.height = renderHeight * dpr;

        // 3. Positionnement CSS (Superposition parfaite)
        this.canvas.style.width = `${renderWidth}px`;
        this.canvas.style.height = `${renderHeight}px`;
        this.canvas.style.left = `${img.offsetLeft}px`;
        this.canvas.style.top = `${img.offsetTop}px`;

        // 4. Config Contexte
        this.ctx = this.canvas.getContext('2d')!;
        this.ctx.scale(dpr, dpr); // On dessine en HD
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }, 100);
  }

  // --- CALCUL COORDONNÉES (C'est ici la correction) ---
  getCoordinates(ev: any) {
    const rect = this.canvas.getBoundingClientRect();
    
    // On gère Touch ou Souris
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;

    // Calcul simple car le ctx.scale(dpr, dpr) gère le ratio interne
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  // --- EVENEMENTS TOUCH (Mobile) ---
  startDrawing(ev: any) {
    // Empêche le scroll ou le zoom
    if(ev.cancelable) ev.preventDefault();
    
    this.isDrawing = true;
    const { x, y } = this.getCoordinates(ev);
    this.lastX = x; this.lastY = y;
  }

  moved(ev: any) {
    if(ev.cancelable) ev.preventDefault();
    if (!this.isDrawing) return;
    
    const { x, y } = this.getCoordinates(ev);
    this.draw(x, y);
  }

  // --- EVENEMENTS MOUSE (PC) ---
  startDrawingMouse(ev: any) {
    this.isDrawing = true;
    const { x, y } = this.getCoordinates(ev);
    this.lastX = x; this.lastY = y;
  }
  movedMouse(ev: any) {
    if (!this.isDrawing) return;
    const { x, y } = this.getCoordinates(ev);
    this.draw(x, y);
  }

  // --- DESSIN COMMUN ---
  draw(x: number, y: number) {
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.lastX = x; 
    this.lastY = y;
  }

  endDrawing() { this.isDrawing = false; }

  setColor(color: string) { this.currentColor = color; }
  
  clearCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
  }
  
  cancel() { this.modalCtrl.dismiss(null, 'cancel'); }

  // --- SAUVEGARDE HD ---
  async save() {
    const finalCanvas = document.createElement('canvas');
    const img = new Image();
    img.src = this.photoWebPath;
    
    await new Promise(r => img.onload = r);
    
    finalCanvas.width = img.naturalWidth;
    finalCanvas.height = img.naturalHeight;
    const ctx = finalCanvas.getContext('2d')!;

    // Image originale
    ctx.drawImage(img, 0, 0);

    // Dessin (Mis à l'échelle)
    // Ratio = Taille Réelle Image / Taille Canvas Ecran (interne)
    // Attention : canvas.width contient déjà le dpr.
    const ratio = img.naturalWidth / this.canvas.width;
    
    // On dessine le canvas d'écran SUR le grand canvas final
    // En multipliant la taille par le dpr pour compenser le ctx.scale initial
    const dpr = window.devicePixelRatio || 1;
    
    ctx.scale(ratio * dpr, ratio * dpr); 
    ctx.drawImage(this.canvas, 0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

    finalCanvas.toBlob((blob) => {
      this.modalCtrl.dismiss(blob, 'confirm');
    }, 'image/jpeg', 0.85);
  }
}