import { useState, useEffect, useCallback } from 'react';
import { Loader2, X, Mail, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useModalA11y } from '../hooks/useModalA11y';

/**
 * ============================================================================
 * SIGN IN / CREATE ACCOUNT
 * ============================================================================
 * One modal, two modes. It opens either because the user clicked "Sign in", or
 * because they tried to save something while signed out — in which case
 * `authPrompt.message` explains why it appeared, so the modal never feels like
 * it interrupted for no reason.
 *
 * Validation runs client-side for instant feedback, but the server validates
 * everything again. Client-side checks are a convenience, never a control:
 * anyone can POST straight to the API.
 * ============================================================================
 */

const MIN_PASSWORD = 8;

export default function AuthModal() {
  const { authPrompt, closeAuth, login, register } = useAuth();

  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const open = Boolean(authPrompt);

  useEffect(() => {
    if (authPrompt?.mode) setMode(authPrompt.mode);
  }, [authPrompt]);

  // Clear any typed password when the modal closes — it should never survive
  // in memory for a modal the user has dismissed.
  useEffect(() => {
    if (!open) {
      setForm({ name: '', email: '', password: '' });
      setFieldErrors({});
      setServerError(null);
    }
  }, [open]);

  const handleClose = useCallback(() => closeAuth(), [closeAuth]);
  const dialogRef = useModalA11y(handleClose);

  if (!open) return null;

  const isRegister = mode === 'register';

  const validate = () => {
    const errors = {};
    if (isRegister && !form.name.trim()) errors.name = 'Please enter your name.';
    if (!form.email.trim()) errors.email = 'Please enter your email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'That does not look like a valid email.';
    }
    if (!form.password) errors.password = 'Please enter a password.';
    else if (isRegister && form.password.length < MIN_PASSWORD) {
      errors.password = `Use at least ${MIN_PASSWORD} characters.`;
    }
    return errors;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      if (isRegister) await register(form.name.trim(), form.email.trim(), form.password);
      else await login(form.email.trim(), form.password);
      // Success closes the modal via the context.
    } catch (err) {
      // The server's message is the useful one — it distinguishes "invalid
      // credentials" from "rate limited" from "email already registered".
      setServerError(
        err?.response?.data?.message ||
          (err?.code === 'ERR_NETWORK'
            ? 'Could not reach the server. Is the backend running?'
            : 'Something went wrong. Please try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((f) => ({ ...f, [key]: undefined }));
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && handleClose()}>
      <div
        ref={dialogRef}
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        tabIndex={-1}
      >
        <button type="button" className="auth-modal__close" onClick={handleClose} aria-label="Close">
          <X size={18} />
        </button>

        <h2 id="auth-title" className="auth-modal__title">
          {isRegister ? 'Create your account' : 'Welcome back'}
        </h2>
        <p className="auth-modal__subtitle">
          {authPrompt?.message ||
            (isRegister
              ? 'Save trips, favourite places and keep your bookings in one place.'
              : 'Sign in to reach your saved trips and bookings.')}
        </p>

        <form onSubmit={onSubmit} noValidate>
          {isRegister && (
            <Field
              id="auth-name" label="Name" icon={UserIcon} value={form.name}
              onChange={(v) => field('name', v)} error={fieldErrors.name}
              autoComplete="name" placeholder="Anii"
            />
          )}

          <Field
            id="auth-email" label="Email" icon={Mail} type="email" value={form.email}
            onChange={(v) => field('email', v)} error={fieldErrors.email}
            autoComplete="email" placeholder="you@example.com"
          />

          <Field
            id="auth-password" label="Password" icon={Lock} type="password" value={form.password}
            onChange={(v) => field('password', v)} error={fieldErrors.password}
            // Tells the browser's password manager whether to offer a saved
            // password or to generate a new one.
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            placeholder={isRegister ? `At least ${MIN_PASSWORD} characters` : '••••••••'}
            hint={isRegister ? `Minimum ${MIN_PASSWORD} characters.` : undefined}
          />

          {serverError && (
            <p className="auth-modal__error" role="alert">
              <AlertCircle size={15} aria-hidden="true" />
              <span>{serverError}</span>
            </p>
          )}

          <button type="submit" className="auth-modal__submit" disabled={submitting}>
            {submitting ? (
              <><Loader2 size={16} className="spin" aria-hidden="true" /> Please wait…</>
            ) : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="auth-modal__switch">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => { setMode(isRegister ? 'login' : 'register'); setServerError(null); setFieldErrors({}); }}
          >
            {isRegister ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}

function Field({ id, label, icon: Icon, type = 'text', value, onChange, error, hint, ...rest }) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint && !error ? `${id}-hint` : undefined;

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className={`auth-field__input${error ? ' auth-field__input--error' : ''}`}>
        <Icon size={16} aria-hidden="true" />
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // Links the message to the input so a screen reader announces it,
          // rather than the error being visible only to sighted users.
          aria-invalid={Boolean(error)}
          aria-describedby={errorId || hintId}
          {...rest}
        />
      </div>
      {error && <span id={errorId} className="auth-field__error" role="alert">{error}</span>}
      {hint && !error && <span id={hintId} className="auth-field__hint">{hint}</span>}
    </div>
  );
}
