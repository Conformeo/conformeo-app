import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ParametresPage } from './parametres.page';

describe('ParametresPage', () => {
  let component: ParametresPage;
  let fixture: ComponentFixture<ParametresPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ParametresPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
