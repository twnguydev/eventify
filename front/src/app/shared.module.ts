import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UtcDatePipe } from '@pipes/utc-date.pipe';

@NgModule({
  declarations: [UtcDatePipe],
  imports: [CommonModule],
  exports: [UtcDatePipe],
})
export class SharedModule {}