import { Component } from '@angular/core';
import { Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-share-dialog',
  standalone: true,
  imports: [],
  templateUrl: './share-dialog.component.html',
  styleUrl: './share-dialog.component.css'
})
export class ShareDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { message: string },
    public dialogRef: MatDialogRef<ShareDialogComponent>
  ) {}

  close() {
    this.dialogRef.close();
  }
}
