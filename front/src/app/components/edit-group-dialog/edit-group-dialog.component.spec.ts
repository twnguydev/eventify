import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditGroupDialogComponent } from './edit-group-dialog.component';

describe('EditGroupDialogComponent', () => {
  let component: EditGroupDialogComponent;
  let fixture: ComponentFixture<EditGroupDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditGroupDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditGroupDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
