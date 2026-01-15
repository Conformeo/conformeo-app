import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QrCodeModalPage } from './qr-code-modal.page';

describe('QrCodeModalPage', () => {
  let component: QrCodeModalPage;
  let fixture: ComponentFixture<QrCodeModalPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(QrCodeModalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
