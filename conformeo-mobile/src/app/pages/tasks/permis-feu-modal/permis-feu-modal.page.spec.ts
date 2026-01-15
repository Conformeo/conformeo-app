import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PermisFeuModalPage } from './permis-feu-modal.page';

describe('PermisFeuModalPage', () => {
  let component: PermisFeuModalPage;
  let fixture: ComponentFixture<PermisFeuModalPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PermisFeuModalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
