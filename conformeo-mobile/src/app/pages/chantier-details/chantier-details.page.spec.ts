import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChantierDetailsPage } from './chantier-details.page';

describe('ChantierDetailsPage', () => {
  let component: ChantierDetailsPage;
  let fixture: ComponentFixture<ChantierDetailsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ChantierDetailsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
