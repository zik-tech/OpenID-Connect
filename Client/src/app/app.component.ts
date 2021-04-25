import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from 'src/core/auth.service';
import { AuthStateModel } from 'src/core/models/auth-state-model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  authState$: Observable<AuthStateModel>;

  constructor(private authService: AuthService) {}

  refreshToken() {
    this.authService.refreshTokens().subscribe();
  }

  ngOnInit(): void {
    this.authState$ = this.authService.state$;
    // This starts up the token refresh process for the app
    this.authService.init().subscribe(
      () => {
        console.info('Startup success');
      },
      (error) => console.warn(error)
    );
  }
}
