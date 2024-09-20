import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { UserService } from '@services/user.service';

@Component({
  selector: 'app-edit-profile-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatInputModule],
  templateUrl: './edit-profile-dialog.component.html',
})
export class EditProfileDialogComponent {
  profileForm: FormGroup;
  selectedFile!: File;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    public dialogRef: MatDialogRef<EditProfileDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.profileForm = this.fb.group({
      name: [data.user.name, Validators.required],
      pseudo: [data.user.pseudo, Validators.required],
      email: [{ value: data.user.email, disabled: true }],
      bio: [data.user.bio],
    });
  }

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0];
  }

  close(): void {
    this.dialogRef.close();
  }

  submit(): void {
    if (this.profileForm.invalid) {
      return;
    }
    
    const formData = new FormData();
    formData.append('pseudo', this.profileForm.value.pseudo || '');
    formData.append('name', this.profileForm.value.name || '');
    formData.append('bio', this.profileForm.value.bio || '');
    
    if (this.selectedFile) {
      formData.append('avatar', this.selectedFile);
    }
    
    this.userService.updateUser(formData).subscribe({
      next: (updatedUser: any) => {
        this.dialogRef.close(updatedUser);
      },
      error: (err) => {
        console.error('Error updating profile', err);
      }
    });
  }
}