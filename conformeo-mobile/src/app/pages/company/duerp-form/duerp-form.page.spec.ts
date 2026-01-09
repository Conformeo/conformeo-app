import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DuerpFormPage } from './duerp-form.page';

describe('DuerpFormPage', () => {
  let component: DuerpFormPage;
  let fixture: ComponentFixture<DuerpFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DuerpFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
