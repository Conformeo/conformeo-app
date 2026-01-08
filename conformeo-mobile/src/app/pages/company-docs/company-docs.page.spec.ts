import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompanyDocsPage } from './company-docs.page';

describe('CompanyDocsPage', () => {
  let component: CompanyDocsPage;
  let fixture: ComponentFixture<CompanyDocsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CompanyDocsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
