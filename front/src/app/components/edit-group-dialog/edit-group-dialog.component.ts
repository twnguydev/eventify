import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { GroupService } from '@services/group.service';
import { UserService } from '@services/user.service';

@Component({
  selector: 'app-edit-group-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatInputModule, CommonModule],
  templateUrl: './edit-group-dialog.component.html',
  styleUrl: './edit-group-dialog.component.css'
})
export class EditGroupDialogComponent {
  groupForm: FormGroup;
  participants: any[] = [];

  filteredUsers: any[] = [];
  selectedUsers: any[] = [];

  constructor(
    private fb: FormBuilder,
    private groupService: GroupService,
    private userService: UserService,
    public dialogRef: MatDialogRef<EditGroupDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.groupForm = this.fb.group({
      title: [data.group.title, Validators.required],
      description: [data.group.description, Validators.required],
      visibility: [data.group.visibility, Validators.required],
      userSearch: ['']
    });

    this.participants = this.data.participants;
  }

  onUserSearch() {
    const query = this.groupForm.get('userSearch')?.value || '';
  
    if (query !== '') {
      this.userService.getUsers(query).subscribe((users: any) => {
        this.filteredUsers = users.filter((user: any) => {
          const isAlreadySelected = this.selectedUsers.some((selectedUser: any) => selectedUser === user);
          const isAlreadyParticipant = this.participants.some((participant: any) => participant.pseudo === user);
          const isCurrentUser = user.id === this.data.userId;

          return !isAlreadySelected && !isAlreadyParticipant && !isCurrentUser;
        });
      });
    } else {
      this.filteredUsers = [];
    }
  }

  selectUser(user: any) {
    this.selectedUsers.push(user);
    this.filteredUsers = [];
    this.groupForm.get('userSearch')?.setValue('');
  }

  removeUser(user: any) {
    this.selectedUsers = this.selectedUsers.filter((u: any) => u !== user);
  }

  close(): void {
    this.dialogRef.close();
  }

  submit(): void {
    if (this.groupForm.invalid) {
      return;
    }

    const data = {
      user_id: this.data.userId,
      title: this.groupForm.value.title,
      description: this.groupForm.value.description,
      visibility: this.groupForm.value.visibility
    }

    this.groupService.updateGroup(this.data.slug, this.data.groupId, data).subscribe({
      next: (updatedGroup: any) => {
        this.dialogRef.close(updatedGroup);
      },
      error: (err) => {
        console.error('Error updating group', err);
      }
    });

    if (this.selectedUsers.length > 0) {
      const data = {
        user_id: this.data.userId,
        participants: this.selectedUsers.map(user => user),
        event_slug: this.data.slug,
      };

      this.groupService.addParticipants(this.data.slug, this.data.groupId, data).subscribe({
        next: (response) => {
          console.log('Participants added');
        },
        error: (err) => {
          console.error('Error adding participants', err);
        }
      });
    }
  }
}
