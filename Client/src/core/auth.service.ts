import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import jwt_decode from 'jwt-decode';
import {
  BehaviorSubject,
  interval,
  Observable,
  of,
  Subscription,
  throwError,
} from 'rxjs';
import { catchError, filter, first, map, mergeMap, tap } from 'rxjs/operators';
import { environment } from './../environments/environment';
import { AuthStateModel } from './models/auth-state-model';
import { AuthTokenModel } from './models/auth-tokens-model';
import { GrantType } from './models/grant-type.model';
import { LoginModel } from './models/login-model';
import { ProfileModel } from './models/profile-model';
import { RefreshGrantModel } from './models/refresh-grant-model';
import { RegisterModel } from './models/register-model';

@Injectable()
export class AuthService {
  private initialState: AuthStateModel = {
    profile: null,
    tokens: null,
    authReady: false,
  };
  private state: BehaviorSubject<AuthStateModel>;
  private refreshSubscription$: Subscription;

  state$: Observable<AuthStateModel>;
  tokens$: Observable<AuthTokenModel>;
  profile$: Observable<ProfileModel>;
  loggedIn$: Observable<boolean>;

  constructor(private http: HttpClient) {
    this.state = new BehaviorSubject<AuthStateModel>(this.initialState);
    this.state$ = this.state.asObservable();

    this.tokens$ = this.state.asObservable().pipe(
      filter((state) => state.authReady),
      map((state) => state.tokens)
    );

    this.profile$ = this.state.asObservable().pipe(
      filter((state) => state.authReady),
      map((state) => state.profile)
    );

    this.loggedIn$ = this.tokens$.pipe(map((tokens) => !!tokens));
  }
  init(): Observable<AuthTokenModel> {
    return this.startupTokenRefresh().pipe(tap(() => this.scheduleRefresh()));
  }

  register(data: RegisterModel): Observable<any> {
    return this.http
      .post(`${environment.baseApiUrl}/account/register`, data)
      .pipe(catchError((res) => throwError(JSON.parse(JSON.stringify(res)))));
  }

  login(user: LoginModel): Observable<any> {
    return this.getTokens(user, GrantType.password).pipe(
      catchError((res) => {
        return throwError(JSON.parse(JSON.stringify(res)));
      }),
      tap((res) => {
        this.scheduleRefresh();
      })
    );
  }

  logout(): void {
    this.updateState({ profile: null, tokens: null });
    if (this.refreshSubscription$) {
      this.refreshSubscription$.unsubscribe();
    }
    this.removeToken();
  }

  refreshTokens(): Observable<AuthTokenModel> {
    return this.state.asObservable().pipe(
      first(),
      map((state) => {
        return state.tokens;
      }),
      mergeMap((tokens) =>
        this.getTokens(
          { refresh_token: tokens.refresh_token },
          GrantType.refreshToken
        ).pipe(catchError(() => throwError('Session Expired')))
      )
    );
  }

  getAccessToken(): string {
    return this.state?.value?.tokens?.access_token;
  }

  private storeToken(tokens: AuthTokenModel): void {
    const previousTokens = this.retrieveTokens();
    if (previousTokens != null && tokens.refresh_token == null) {
      tokens.refresh_token = previousTokens.refresh_token;
    }
    localStorage.setItem('auth-tokens', JSON.stringify(tokens));
  }

  private retrieveTokens(): AuthTokenModel {
    const tokensString = localStorage.getItem('auth-tokens');
    const tokensModel: AuthTokenModel =
      tokensString == null ? null : JSON.parse(tokensString);
    return tokensModel;
  }

  private removeToken(): void {
    localStorage.removeItem('auth-tokens');
  }

  private updateState(newState: AuthStateModel): void {
    const previousState = this.state.getValue();
    this.state.next(Object.assign({}, previousState, newState));
  }

  private getTokens(
    data: RefreshGrantModel | LoginModel,
    grantType: GrantType
  ): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    const options = { headers: headers };

    Object.assign(data, {
      grant_type: grantType,
      client_id: 'angular',
      scope: 'openid offline_access profile email roles',
    });

    let params = new HttpParams();
    Object.keys(data).forEach(
      (key) => (params = params.append(key, data[key]))
    );

    return this.http
      .post(`${environment.baseApiUrl}/connect/token`, params, options)
      .pipe(
        tap((res) => {
          const tokens: AuthTokenModel = JSON.parse(JSON.stringify(res));
          const now = new Date();
          tokens.expiration_date = new Date(
            now.getTime() + tokens.expires_in * 1000
          )
            .getTime()
            .toString();

          const profile: ProfileModel = jwt_decode(tokens.id_token);
          this.storeToken(tokens);
          this.updateState({ authReady: true, tokens, profile });
        })
      );
  }

  private startupTokenRefresh(): Observable<AuthTokenModel> {
    return of(this.retrieveTokens()).pipe(
      mergeMap((tokens: AuthTokenModel) => {
        if (!tokens) {
          this.updateState({ authReady: true });
          return throwError('No token in Storage');
        }
        const profile: ProfileModel = jwt_decode(tokens.id_token);
        this.updateState({ tokens, profile });

        if (+tokens.expiration_date > new Date().getTime()) {
          this.updateState({ authReady: true });
        }

        return this.refreshTokens();
      }),
      catchError((error) => {
        this.logout();
        this.updateState({ authReady: true });
        return throwError(error);
      })
    );
  }

  private scheduleRefresh(): void {
    this.refreshSubscription$ = this.tokens$
      .pipe(
        first(),
        // refresh every half the total expiration time
        mergeMap((tokens) => interval((tokens.expires_in / 2) * 1000)),
        mergeMap(() => this.refreshTokens())
      )
      .subscribe();
  }
}
