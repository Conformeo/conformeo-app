import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PdpFormPage } from './pdp-form.page';

describe('PdpFormPage', () => {
  let component: PdpFormPage;
  let fixture: ComponentFixture<PdpFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PdpFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
