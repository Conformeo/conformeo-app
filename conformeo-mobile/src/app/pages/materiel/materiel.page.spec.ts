import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MaterielPage } from './materiel.page';

describe('MaterielPage', () => {
  let component: MaterielPage;
  let fixture: ComponentFixture<MaterielPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MaterielPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
