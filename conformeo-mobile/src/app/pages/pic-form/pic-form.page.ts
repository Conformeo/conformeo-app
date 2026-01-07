import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, NavController, ModalController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api';
import { addIcons } from 'ionicons';
import { walk, lockClosed, home, cube, trash, build, flash, car, warning, save, map, image } from 'ionicons/icons';
import { PicModalComponent } from '../chantier-details/pic-modal/pic-modal.component'

@Component({
  selector: 'app-pic-form',
  templateUrl: './pic-form.page.html',
  styleUrls: ['./pic-form.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class PicFormPage implements OnInit {
  // 👇 On initialise à 0 pour garantir que c'est toujours un nombre
  chantierId: number = 0;
  
  pic = {
    acces: '', clotures: '', base_vie: '', stockage: '', 
    dechets: '', levage: '', reseaux: '', circulations: '', 
    signalisation: '', final_url: ''
  };

  constructor(
    private route: ActivatedRoute,
    public api: ApiService, // 👇 Mettre 'public' ici aussi est une bonne pratique si utilisé dans le HTML
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private modalCtrl: ModalController
  ) {
    addIcons({ walk, lockClosed, home, cube, trash, build, flash, car, warning, save, map, image });
  }

  ngOnInit() {
    // 👇 Correction de la récupération de l'ID
    const idParam = this.route.snapshot.paramMap.get('id');
    // Si idParam existe, on le convertit en nombre (+), sinon on met 0
    this.chantierId = idParam ? parseInt(idParam, 10) : 0;

    if (this.chantierId > 0) {
      this.loadPic();
    }
  }

  loadPic() {
    // Grâce à la modif dans l'étape 1, ceci ne fera plus d'erreur
    this.api.http.get(`${this.api.apiUrl}/chantiers/${this.chantierId}/pic`).subscribe((data: any) => {
      if (data && data.id) {
        this.pic = data;
      }
    });
  }

  async openPicStudio() {
    const modal = await this.modalCtrl.create({
      component: PicModalComponent,
      componentProps: { 
        chantierId: this.chantierId || 0
      }
    });
    
    await modal.present();
    
    const { data } = await modal.onWillDismiss();
    if (data) {
      this.loadPic();
    }
  }

  savePic() {
    this.api.http.post(`${this.api.apiUrl}/chantiers/${this.chantierId}/pic`, this.pic).subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({ message: 'Notice PIC enregistrée ! ✅', duration: 2000, color: 'success' });
        toast.present();
        this.navCtrl.back();
      },
      error: async () => {
        const toast = await this.toastCtrl.create({ message: 'Erreur sauvegarde', duration: 2000, color: 'danger' });
        toast.present();
      }
    });
  }
}