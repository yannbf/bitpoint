import { Store } from '@ngrx/store';
import { Observable } from 'rxjs/Observable';
import { of as obsOf } from 'rxjs/observable/of';
import { from } from 'rxjs/observable/from';
import { Injectable } from '@angular/core';
import { Actions, Effect } from '@ngrx/effects';

import { ApplicationState } from './../app.state';
import { AuthProvider } from './../../providers/auth/auth.provider';
import { AuthQuery } from './auth.reducer';
import { UserCredentials, SignupData } from './../../shared/models';
import {
  AuthActionTypes,
  AuthenticateAction,
  SignupAction,
  SignupFailAction,
  LoginAction,
  LoginFailAction,
  FacebookAuthAction,
  FacebookAuthFailAction,
  SignoutAction,
  SignoutFailAction,
} from './auth.actions';
import {
  EditProfileAction,
  SetupProfileAction,
  LoadProfileAction,
} from './../profile/profile.actions';

@Injectable()
export class AuthFacade {
  // **************************************************************
  // Observable Queries to be shared for access by interested views
  // **************************************************************

  authUser$ = this.store
    .select(AuthQuery.getCheckedAuthState)
    .filter(isAuthenticated => !!isAuthenticated)
    .switchMap(_ => this.store.select(AuthQuery.getAuthUser));

  // ********************************************
  // Effects to be registered at the Module level
  // ********************************************

  @Effect()
  signup$ = this.actions$
    .ofType<SignupAction>(AuthActionTypes.SIGNUP)
    .map(action => action.payload)
    .switchMap(data =>
      this.authProvider
        .signup(data.credentials)
        .switchMap(authUser =>
          from([
            new AuthenticateAction(authUser),
            new SetupProfileAction({
              userProfile: data.userProfile,
              uid: authUser.uid,
            }),
          ])
        )
        .catch(error => obsOf(new SignupFailAction(error)))
    );

  @Effect()
  login$ = this.actions$
    .ofType<LoginAction>(AuthActionTypes.LOGIN)
    .map(action => action.payload)
    .switchMap(credentials =>
      this.authProvider
        .signin(credentials)
        .map(authUser => new AuthenticateAction(authUser))
        .catch(error => obsOf(new LoginFailAction(error)))
    );

  @Effect()
  signout$ = this.actions$
    .ofType<SignoutAction>(AuthActionTypes.SIGNOUT)
    .switchMap(credentials =>
      this.authProvider
        .signout()
        // When firebase signOut is complete, we check authState again.
        // We'll get `null` which we dispatch through the AuthenticateAction
        .switchMap(_ =>
          this.authProvider
            .checkAuthState()
            .map(authUser => new AuthenticateAction(authUser))
        )
        .catch(error => obsOf(new SignoutFailAction(error)))
    );

  @Effect()
  facebookAuth$ = this.actions$
    .ofType<FacebookAuthAction>(AuthActionTypes.FACEBOOK_AUTH)
    .switchMap(_ =>
      this.authProvider
        .facebookAuth()
        .map(authUser => new AuthenticateAction(authUser))
        .catch(error => obsOf(new FacebookAuthFailAction(error)))
    );

  @Effect()
  authenticate$ = this.actions$
    .ofType<AuthenticateAction>(AuthActionTypes.AUTHENTICATE)
    .map(action => action.payload)
    .filter(authUser => !!authUser)
    .map(authUser => new LoadProfileAction(authUser.uid));

  constructor(
    private store: Store<ApplicationState>,
    private actions$: Actions,
    private authProvider: AuthProvider
  ) {
    authProvider.checkAuthState().subscribe(authState => {
      this.store.dispatch(new AuthenticateAction(authState));
    });
  }

  // ********************
  // Auth Action creators
  // ********************

  signup(data: SignupData) {
    this.store.dispatch(new SignupAction(data));
    return this.authUser$;
  }

  login(credentials: UserCredentials) {
    this.store.dispatch(new LoginAction(credentials));
    return this.authUser$;
  }

  facebookAuth() {
    this.store.dispatch(new FacebookAuthAction());
    return this.authUser$;
  }

  signout() {
    this.store.dispatch(new SignoutAction());
  }
}
