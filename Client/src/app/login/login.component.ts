import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { environment } from 'src/environments/environment';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.template.html',
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  response: any;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
    });
  }

  getWetherForecast() {
    this.http.get(`${environment.baseApiUrl}/WeatherForecast/Get`).subscribe({
      next: (data) => console.log(data),
      error: (error) => console.log(error),
    });
  }
  logOut() {
    this.authService.logout();
  }
  onSubmit() {
    this.authService.login(this.loginForm.value).subscribe(
      () => {
        this.ngOnInit();
        this.response = 'Successfully loggedin';
      },
      (error) => (this.response = error)
    );
  }
}
