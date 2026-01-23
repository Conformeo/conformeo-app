import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SecuriteDocPage } from './securite-doc.page';

describe('SecuriteDocPage', () => {
  let component: SecuriteDocPage;
  let fixture: ComponentFixture<SecuriteDocPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SecuriteDocPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
