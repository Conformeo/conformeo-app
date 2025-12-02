import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QhseFormPage } from './qhse-form.page';

describe('QhseFormPage', () => {
  let component: QhseFormPage;
  let fixture: ComponentFixture<QhseFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(QhseFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
