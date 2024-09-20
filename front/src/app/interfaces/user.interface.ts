export interface IUser {
  id?: number;
  name: string;
  pseudo: string;
  email: string;
  oauth_avatar?: string;
  avatar?: string;
  bio?: string;
  token?: string;
  updated_at?: string;
  created_at?: string;
}

export interface IAuthCallbackResponse {
  user: IUser;
  token: string;
}

export interface IUserResponse {
  user: IUser;
}

export interface IUserUpdateResponse {
  message: string;
  user: IUser;
}

export interface IUserPseudoResponse {
  pseudos: string[];
}