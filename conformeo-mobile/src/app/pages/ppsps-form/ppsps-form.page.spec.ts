import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PpspsFormPage } from './ppsps-form.page';

describe('PpspsFormPage', () => {
  let component: PpspsFormPage;
  let fixture: ComponentFixture<PpspsFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PpspsFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
