import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LegalMentionsComponent } from './legal-mentions.component';

describe('LegalMentionsComponent', () => {
  let component: LegalMentionsComponent;
  let fixture: ComponentFixture<LegalMentionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LegalMentionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LegalMentionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
