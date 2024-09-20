import { IUser } from '@interfaces/user.interface';

export interface IEventResponse {
  events: IEvent[];
  total_hits: number;
}

export interface IEventRequest {
  event: IEvent;
}

export interface IEvent {
  title: string;
  description: string;
  url: string;
  slug: string;
  image: string;
  dates: IDate;
  location: ILocation;
  creator: IUser;
  distance?: number;
  participants?: IUser[];
  visibility: 'public' | 'private' | 'participants';
}

export interface IDate {
  start: Date;
  end: Date;
}

export interface ILocation {
  name: string;
  address: string;
  city: string;
  coordinates: number[];
}