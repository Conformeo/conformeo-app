import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PicFormPage } from './pic-form.page';

describe('PicFormPage', () => {
  let component: PicFormPage;
  let fixture: ComponentFixture<PicFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PicFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
