"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  INVALID_EMAIL_MESSAGE,
  validateEmailClient,
} from "@/lib/emailValidation";
import { loginUser, registerUser, validateEmailOnServer, type ApiError } from "@/lib/api";
import { SESSION_KEY } from "@/lib/session";

type AuthMode = "login" | "register";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
  const [emailValid, setEmailValid] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  function runClientEmailCheck(value: string): boolean {
    const trimmed = value.trim();
    const result = validateEmailClient(value);

    if (!trimmed) {
      setEmailWarning(null);
      setEmailValid(false);
      return false;
    }

    if (!result.valid) {
      setEmailWarning(result.message ?? INVALID_EMAIL_MESSAGE);
      setEmailValid(false);
      return false;
    }

    setEmailWarning(null);
    setEmailValid(true);
    return true;
  }

  async function handleEmailBlur() {
    setTouched((t) => ({ ...t, email: true }));
    if (!email.trim()) {
      setEmailValid(false);
      return;
    }

    const clientOk = runClientEmailCheck(email);
    if (!clientOk) return;

    try {
      await validateEmailOnServer(email);
      setEmailValid(true);
      setEmailWarning(null);
    } catch (err) {
      const apiErr = err as ApiError;
      setEmailValid(false);
      if (apiErr.field !== "network") {
        setEmailWarning(apiErr.message ?? INVALID_EMAIL_MESSAGE);
      }
    }
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    setFormError(null);
    if (!value.trim()) {
      setEmailWarning(null);
      setEmailValid(false);
      return;
    }
    if (touched.email || emailWarning || emailValid) {
      runClientEmailCheck(value);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched({ email: true, password: true });
    setFormError(null);

    const clientOk = runClientEmailCheck(email);
    if (!clientOk) {
      return;
    }

    setIsSubmitting(true);

    try {
      await validateEmailOnServer(email);
    } catch (err) {
      const apiErr = err as ApiError;
      setEmailValid(false);
      if (apiErr.field === "network") {
        setFormError(apiErr.message ?? "Cannot reach the server.");
      } else {
        setEmailWarning(apiErr.message ?? INVALID_EMAIL_MESSAGE);
      }
      setIsSubmitting(false);
      return;
    }

    try {
      const response =
        mode === "register"
          ? await registerUser(email, password)
          : await loginUser(email, password);

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(response.user));
      router.push("/dashboard");
    } catch (err) {
      const apiErr = err as ApiError;
      setEmailValid(false);
      if (apiErr.field === "email") {
        setEmailWarning(apiErr.message ?? INVALID_EMAIL_MESSAGE);
      } else {
        setFormError(apiErr.message ?? "Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-card w-full max-w-md">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800/70">
          KaamKaaj
        </p>
        <h1 className="mt-2 font-serif text-3xl text-stone-900">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Track your work and reading in one calm place.
        </p>
      </div>

      <div
        className="mb-6 grid grid-cols-2 rounded-xl bg-stone-200/60 p-1"
        role="tablist"
        aria-label="Authentication mode"
      >
        {(["login", "register"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={mode === tab}
            onClick={() => {
              setMode(tab);
              setFormError(null);
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === tab
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {tab === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="field-label">
            Email address
          </label>
          <div className="field-input-wrap">
            {emailValid ? (
              <span className="field-input-tick" aria-hidden="true">
                <EmailValidTick />
              </span>
            ) : null}
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={handleEmailBlur}
              className={`field-input ${
                emailValid ? "field-input--valid field-input--with-tick" : ""
              } ${emailWarning ? "field-input--error" : ""}`}
              placeholder="you@company.com"
              aria-invalid={Boolean(emailWarning)}
              aria-describedby={
                emailWarning
                  ? "email-warning"
                  : emailValid
                    ? "email-valid"
                    : "email-hint"
              }
            />
          </div>
          {emailWarning ? (
            <p id="email-warning" role="alert" className="field-warning">
              {emailWarning}
            </p>
          ) : emailValid ? (
            <p id="email-valid" className="field-valid">
              Email looks good.
            </p>
          ) : (
            <p id="email-hint" className="field-hint">
              We check format and that the email domain exists.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="field-label">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFormError(null);
            }}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            className="field-input"
            placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
            minLength={mode === "register" ? 8 : undefined}
          />
        </div>

        {formError ? (
          <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            {formError}
          </p>
        ) : null}

        <button type="submit" disabled={isSubmitting} className="primary-button">
          {isSubmitting
            ? "Checking…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-stone-500">
        After sign-in you&apos;ll reach your Work Tracker and Reading List.
      </p>
    </div>
  );
}

function EmailValidTick() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="9" cy="9" r="9" fill="currentColor" fillOpacity="0.12" />
      <path
        d="M5.25 9.25L7.75 11.75L12.75 6.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
