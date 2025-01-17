import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NewUser } from '../shared/data-access/api';
import { AuthLayout } from '../shared/ui/auth-layout/auth-layout.component';
import { TypedFormGroup } from '../shared/utils/typed-form';
import { RegisterStore } from './register.store';

@Component({
  selector: 'app-register',
  template: `
    <app-auth-layout>
      <h1 class="text-xs-center">Sign up</h1>
      <p class="text-xs-center">
        <a routerLink="/login">Have an account?</a>
      </p>

      <ng-container *ngIf="registerErrors$ | async as registerErrors">
        <ul class="error-messages" *ngIf="registerErrors.hasError">
          <li *ngFor="let error of registerErrors.errors">{{ error }}</li>
        </ul>
      </ng-container>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <fieldset class="form-group">
          <input
            class="form-control form-control-lg"
            type="text"
            placeholder="Username"
            formControlName="username"
          />
        </fieldset>
        <fieldset class="form-group">
          <input
            class="form-control form-control-lg"
            type="text"
            placeholder="Email"
            formControlName="email"
          />
        </fieldset>
        <fieldset class="form-group">
          <input
            class="form-control form-control-lg"
            type="password"
            placeholder="Password"
            formControlName="password"
          />
        </fieldset>
        <button
          type="submit"
          class="btn btn-lg btn-primary pull-xs-right"
          [disabled]="form.invalid"
        >
          Sign up
        </button>
      </form>
    </app-auth-layout>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [AuthLayout, CommonModule, RouterModule, ReactiveFormsModule],
  providers: [RegisterStore],
})
export class Register {
  constructor(private fb: FormBuilder, private store: RegisterStore) {}

  readonly registerErrors$ = this.store.registerErrors$;

  readonly form: TypedFormGroup<NewUser> = this.fb.nonNullable.group({
    username: [''],
    email: ['', [Validators.email, Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit() {
    this.store.register(this.form.getRawValue());
  }
}
