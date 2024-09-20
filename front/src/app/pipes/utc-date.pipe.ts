import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'utcDate'
})
export class UtcDatePipe implements PipeTransform {

  transform(value: any, format: string = 'dd/MM/yyyy, HH:mm a', use12Hour: boolean = false): any {
    if (!value) return value;

    let date = new Date(value);
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: undefined,
      timeZone: 'UTC',
      hour12: use12Hour
    }).format(date);
  }

}