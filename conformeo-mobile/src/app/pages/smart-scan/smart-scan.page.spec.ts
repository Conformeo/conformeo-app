import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SmartScanPage } from './smart-scan.page';

describe('SmartScanPage', () => {
  let component: SmartScanPage;
  let fixture: ComponentFixture<SmartScanPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SmartScanPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
