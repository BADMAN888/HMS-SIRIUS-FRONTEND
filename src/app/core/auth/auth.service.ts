
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, throwError } from 'rxjs';

import { AuthRequest } from '../models/auth/auth-request.model';
import { AuthResponse } from '../models/auth/auth-response.model';
import { RefreshTokenRequest } from '../models/auth/refresh-token-request.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly tokenKey = 'access_token';
  private readonly refreshTokenKey = 'refresh_token';
  private readonly apiUrl = 'http://localhost:8080/auth';

  readonly isAuthenticated = signal(
    this.hasValidToken()
  );

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  register(request: AuthRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(
        `${this.apiUrl}/register`,
        request
      )
      .pipe(
        tap(response => {
          this.setTokens(
            response.token,
            response.refreshToken
          );
        })
      );
  }

  login(request: AuthRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(
        `${this.apiUrl}/login`,
        request
      )
      .pipe(
        tap(response => {
          this.setTokens(
            response.token,
            response.refreshToken
          );
        })
      );
  }

  refresh(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      return throwError(
        () => new Error('Refresh token is missing')
      );
    }

    const request: RefreshTokenRequest = {
      refreshToken
    };

    return this.http
      .post<AuthResponse>(
        `${this.apiUrl}/refresh`,
        request
      )
      .pipe(
        tap(response => {
          this.setTokens(
            response.token,
            response.refreshToken
          );
        })
      );
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  setTokens(
    token: string,
    refreshToken: string
  ): void {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.refreshTokenKey, refreshToken);

    this.isAuthenticated.set(true);
  }

  clearToken(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);

    this.isAuthenticated.set(false);
  }

  logout(): void {
    this.clearToken();
    this.router.navigate(['/login']);
  }

  hasToken(): boolean {
    return !!this.getToken();
  }

  hasRefreshToken(): boolean {
    return !!this.getRefreshToken();
  }

  hasValidToken(): boolean {
    const token = this.getToken();

    return !!token && !this.isTokenExpired(token);
  }

  isTokenExpired(token: string): boolean {
    try {
      const payload = token.split('.')[1];

      if (!payload) {
        return true;
      }

      const decodedPayload = JSON.parse(
        atob(
          payload
            .replace(/-/g, '+')
            .replace(/_/g, '/')
        )
      );

      return (
        !decodedPayload.exp ||
        decodedPayload.exp * 1000 <= Date.now()
      );
    } catch {
      return true;
    }
  }
}
