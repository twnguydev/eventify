import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventCatalogueMobileComponent } from './event-catalogue-mobile.component';

describe('EventCatalogueMobileComponent', () => {
  let component: EventCatalogueMobileComponent;
  let fixture: ComponentFixture<EventCatalogueMobileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventCatalogueMobileComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventCatalogueMobileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
