import { Component, Input, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ApiService, PIC } from 'src/app/services/api';
import { addIcons } from 'ionicons';
import { close, save, add, trash } from 'ionicons/icons';

@Component({
  selector: 'app-pic-modal',
  template: `
    <ion-header>
      <ion-toolbar color="dark">
        <ion-buttons slot="start"><ion-button (click)="close()"><ion-icon name="close"></ion-icon></ion-button></ion-buttons>
        <ion-title>Plan d'Installation</ion-title>
        <ion-buttons slot="end"><ion-button (click)="save()" color="success"><ion-icon name="save"></ion-icon></ion-button></ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="no-scroll" style="--background: #222;">
      
      <div class="canvas-container">
        <canvas #canvas 
          (touchstart)="handleStart($event)" 
          (touchmove)="handleMove($event)" 
          (touchend)="handleEnd()">
        </canvas>
        
        <div *ngIf="!backgroundImg" class="empty-placeholder" (click)="chooseBackground()">
          <ion-icon name="add" size="large"></ion-icon>
          <p>1. Charger le Plan de Masse</p>
        </div>
      </div>

      <div class="toolbar" *ngIf="backgroundImg">
        <p class="toolbar-title">Ajouter un élément :</p>
        <div class="stickers-row">
          <div class="sticker" (click)="addUnknown('🏗️', 'Grue')">🏗️</div>
          <div class="sticker" (click)="addUnknown('🏠', 'Base Vie')">🏠</div>
          <div class="sticker" (click)="addUnknown('⚡', 'Armoire')">⚡</div>
          <div class="sticker" (click)="addUnknown('💧', 'Eau')">💧</div>
          <div class="sticker" (click)="addUnknown('♻️', 'Benne')">♻️</div>
          <div class="sticker" (click)="addUnknown('🚧', 'Accès')">🚧</div>
          <div class="sticker delete" (click)="deleteSelected()">
            <ion-icon name="trash"></ion-icon>
          </div>
        </div>
      </div>

    </ion-content>
  `,
  styles: [`
    .no-scroll { --overflow: hidden; }
    .canvas-container {
      width: 100%; height: 80%;
      background: #333;
      display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
    }
    .empty-placeholder {
      text-align: center; color: #aaa;
      border: 2px dashed #555; padding: 40px; border-radius: 12px;
    }
    .toolbar {
      height: 20%; background: #1a1a1a; padding: 10px;
      display: flex; flex-direction: column; justify-content: center;
    }
    .toolbar-title { margin: 0 0 10px; color: #666; font-size: 12px; text-align: center; }
    .stickers-row { display: flex; justify-content: space-around; align-items: center; }
    .sticker {
      font-size: 28px; background: #333; width: 45px; height: 45px;
      border-radius: 8px; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    }
    .sticker:active { transform: scale(0.9); }
    .sticker.delete { background: #800; color: white; font-size: 20px; }
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
  elements: any[] = []; // Liste des stickers { id, icon, x, y, label }
  
  selectedId: number | null = null; // Élément en cours de déplacement
  isDragging = false;

  constructor(private modalCtrl: ModalController, private api: ApiService) {
    addIcons({ close, save, add, trash });
  }

  ngOnInit() {
    // On vérifie si un PIC existe déjà
    this.api.getPIC(this.chantierId).subscribe(pic => {
      if (pic && pic.background_url) {
        this.loadExistingPic(pic);
      }
    });
  }

  // 1. CHOISIR LE FOND (PHOTO DU PLAN)
  async chooseBackground() {
    const image = await Camera.getPhoto({
      quality: 80, allowEditing: false, resultType: CameraResultType.Uri, source: CameraSource.Prompt
    });
    if (image.webPath) {
      this.loadBackground(image.webPath);
    }
  }

  loadBackground(src: string) {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      this.backgroundImg = img;
      this.initCanvas();
      this.draw();
    };
  }

  loadExistingPic(pic: PIC) {
    this.elements = pic.elements_data || [];
    this.loadBackground(pic.background_url); // Pour l'instant on recharge depuis l'URL
  }

  initCanvas() {
    if (!this.backgroundImg) return;
    this.canvas = this.canvasEl.nativeElement;
    
    // On adapte le canvas à l'écran tout en gardant le ratio de l'image
    const screenW = this.canvas.parentElement!.clientWidth;
    const screenH = this.canvas.parentElement!.clientHeight;
    
    // Ratio image
    const imgRatio = this.backgroundImg.width / this.backgroundImg.height;
    
    // On calcule la meilleure taille pour que ça rentre
    let finalW = screenW;
    let finalH = screenW / imgRatio;
    
    if (finalH > screenH) {
      finalH = screenH;
      finalW = finalH * imgRatio;
    }

    // Haute résolution (Retina)
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = finalW * dpr;
    this.canvas.height = finalH * dpr;
    this.canvas.style.width = `${finalW}px`;
    this.canvas.style.height = `${finalH}px`;

    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
  }

  // 2. AJOUTER UN STICKER
  addUnknown(icon: string, label: string) {
    if (!this.backgroundImg) return;
    
    // On ajoute au centre (coordonnées logiques écran)
    const cw = parseInt(this.canvas.style.width);
    const ch = parseInt(this.canvas.style.height);
    
    this.elements.push({
      id: Date.now(),
      icon: icon,
      label: label,
      x: cw / 2,
      y: ch / 2
    });
    this.draw();
  }

  // 3. DESSIN (BOUCLE DE RENDU)
  draw() {
    if (!this.ctx || !this.backgroundImg) return;
    
    // Effacer
    const cw = parseInt(this.canvas.style.width);
    const ch = parseInt(this.canvas.style.height);
    this.ctx.clearRect(0, 0, cw, ch);
    
    // Dessiner Fond
    this.ctx.drawImage(this.backgroundImg, 0, 0, cw, ch);
    
    // Dessiner Éléments
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    for (let el of this.elements) {
      // Cercle de fond si sélectionné
      if (el.id === this.selectedId) {
        this.ctx.beginPath();
        this.ctx.arc(el.x, el.y, 25, 0, 2 * Math.PI);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.fill();
      }
      
      // L'icône (Emoji)
      this.ctx.font = "30px Arial";
      this.ctx.fillText(el.icon, el.x, el.y);
      
      // Le label en dessous
      this.ctx.font = "bold 10px Arial";
      this.ctx.fillStyle = "white";
      this.ctx.strokeStyle = "black";
      this.ctx.lineWidth = 2;
      this.ctx.strokeText(el.label, el.x, el.y + 25);
      this.ctx.fillText(el.label, el.x, el.y + 25);
    }
  }

  // 4. GESTION TACTILE (DRAG & DROP)
  handleStart(ev: any) {
    if(ev.cancelable) ev.preventDefault();
    const { x, y } = this.getTouchPos(ev);
    
    // Trouver si on touche un élément (Zone de 30px)
    // On cherche à l'envers pour prendre celui du dessus
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      const dist = Math.sqrt((x - el.x)**2 + (y - el.y)**2);
      if (dist < 30) {
        this.selectedId = el.id;
        this.isDragging = true;
        this.draw();
        return;
      }
    }
    // Si on clique à côté, on désélectionne
    this.selectedId = null;
    this.draw();
  }

  handleMove(ev: any) {
    if(ev.cancelable) ev.preventDefault();
    if (!this.isDragging || this.selectedId === null) return;
    
    const { x, y } = this.getTouchPos(ev);
    const el = this.elements.find(e => e.id === this.selectedId);
    if (el) {
      el.x = x;
      el.y = y;
      this.draw();
    }
  }

  handleEnd() {
    this.isDragging = false;
  }

  getTouchPos(ev: any) {
    const rect = this.canvas.getBoundingClientRect();
    const touch = ev.touches[0];
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  }

  deleteSelected() {
    if (this.selectedId) {
      this.elements = this.elements.filter(e => e.id !== this.selectedId);
      this.selectedId = null;
      this.draw();
    }
  }

  close() { this.modalCtrl.dismiss(); }

  // 5. SAUVEGARDE
  async save() {
    // A. Uploader l'image de fond si elle vient du téléphone (blob local)
    // Note : Pour simplifier ici, on suppose que this.backgroundImg.src est déjà une URL ou base64 valide.
    // Dans un vrai cas, il faudrait faire comme pour les photos : convertToBlob -> Upload -> GetURL.
    
    // B. Générer l'image finale (Fond + Icônes aplatis)
    this.selectedId = null; // On désélectionne pour ne pas avoir le cercle gris
    this.draw();
    
    // On crée un blob du canvas
    this.canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        // C. Upload de l'image FINALE (le plan terminé) sur Cloudinary
        this.api.uploadPhoto(blob).subscribe({
            next: (res) => {
                const finalUrl = res.url;
                
                // D. Sauvegarde en base
                const picData: PIC = {
                    chantier_id: this.chantierId,
                    // Attention: Ici on devrait aussi uploader le background brut si c'est une nouvelle photo
                    // Pour ce MVP, on sauvegarde l'image finale comme background pour simplifier la réédition (écrasement)
                    background_url: finalUrl, 
                    final_url: finalUrl,
                    elements_data: this.elements
                };

                this.api.savePIC(picData).subscribe(() => {
                    alert("PIC sauvegardé !");
                    this.modalCtrl.dismiss();
                });
            },
            error: () => alert("Erreur Upload")
        });
    });
  }
}