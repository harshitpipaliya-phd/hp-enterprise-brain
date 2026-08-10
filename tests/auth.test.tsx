import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Signup from '../src/components/auth/Signup';
import Login from '../src/components/auth/Login';

/**
 * The two auth screens.
 *
 * What is worth asserting here is not that they render — it is the things the
 * brief is actually about and that a screenshot cannot show:
 *
 *   1. The signup form collects an ORGANIZATION and nothing else. No
 *      administrator section, no first/last name, no separate work email, no
 *      administrator mobile, no OTP, no institute type, no captcha. Not
 *      hidden or conditional: absent.
 *   2. No composition rules are imposed on the password — only non-empty and
 *      matching, which is what the server enforces.
 *   3. A server 422 lands on the FIELD it belongs to, with aria-invalid and an
 *      aria-describedby message.
 *   4. Signup ends at sign-in and carries the email across.
 *
 * Console output is asserted too. A React key warning or a controlled/
 * uncontrolled flip prints to console.error and is otherwise invisible in a
 * passing test — "no console errors" has to be checked to be claimed.
 */

const SIGNUP_OK = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: {
    id: '574',
    email: 'ops@northwind.example',
    firstName: 'Administrator',
    lastName: '',
    profileId: '105',
    role: 'tenant_admin',
  },
  organization: { id: '12', name: 'Northwind Logistics', logo: null },
};

function fill(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit(name: RegExp) {
  fireEvent.submit(screen.getByRole('button', { name }).closest('form')!);
}

let consoleError: ReturnType<typeof vi.spyOn>;
let consoleWarn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  // Every test in this file asserts a clean console as a side condition.
  expect(consoleError).not.toHaveBeenCalled();
  expect(consoleWarn).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

describe('Signup', () => {
  it('collects an organization and nothing else', () => {
    render(<Signup onCreated={() => {}} onSwitchToLogin={() => {}} />);

    // Exactly five inputs: name, email, mobile, password, confirmation.
    const inputs = Array.from(document.querySelectorAll('input'));
    expect(inputs.map((i) => i.getAttribute('name'))).toEqual([
      'organizationName',
      'organizationEmail',
      'organizationMobile',
      'password',
      'password_confirmation',
    ]);
  });

  it('shows no administrator section and no legacy fields', () => {
    render(<Signup onCreated={() => {}} onSwitchToLogin={() => {}} />);

    const body = document.body.textContent ?? '';
    for (const gone of [/administrator/i, /first name/i, /last name/i, /work email/i, /OTP/i, /institute type/i, /captcha/i, /resend/i]) {
      expect(body).not.toMatch(gone);
    }

    for (const name of ['firstName', 'lastName', 'email', 'mobile', 'otp', 'institute_type']) {
      expect(document.querySelector(`[name="${name}"]`)).toBeNull();
    }
  });

  it('tells the user the organization email is their login', () => {
    render(<Signup onCreated={() => {}} onSwitchToLogin={() => {}} />);
    expect(screen.getByText(/you will sign in with this address/i)).toBeTruthy();
  });

  it('marks the mobile optional and the rest required', () => {
    render(<Signup onCreated={() => {}} onSwitchToLogin={() => {}} />);

    expect(screen.getByLabelText(/organization mobile/i).hasAttribute('required')).toBe(false);
    expect(screen.getByLabelText(/organization name/i).hasAttribute('required')).toBe(true);
    expect(screen.getByLabelText(/organization email/i).hasAttribute('required')).toBe(true);
    expect(screen.getByLabelText(/^password$/i).hasAttribute('required')).toBe(true);
    expect(screen.getByLabelText(/confirm password/i).hasAttribute('required')).toBe(true);
  });

  it('imposes no password composition rules in the UI', () => {
    render(<Signup onCreated={() => {}} onSwitchToLogin={() => {}} />);

    const body = document.body.textContent ?? '';
    for (const rule of [/10\+? characters/i, /uppercase/i, /lowercase/i, /special character/i, /at least one number/i]) {
      expect(body).not.toMatch(rule);
    }
    // And no strength meter.
    expect(document.querySelector('.eb-auth-meter')).toBeNull();
  });

  it('flags a password mismatch without contacting the server', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<Signup onCreated={() => {}} onSwitchToLogin={() => {}} />);

    fill(/^password$/i, 'harbour road');
    fill(/confirm password/i, 'harbour roax');

    expect(screen.getByText('The two passwords do not match.')).toBeTruthy();
    expect(screen.getByLabelText(/confirm password/i).getAttribute('aria-invalid')).toBe('true');

    submit(/create organization/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('accepts a simple all-lowercase password', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => SIGNUP_OK,
    } as Response);

    render(<Signup onCreated={() => {}} onSwitchToLogin={() => {}} />);

    fill(/organization name/i, 'Northwind Logistics');
    fill(/organization email/i, 'ops@northwind.example');
    fill(/^password$/i, 'correcthorsebattery');
    fill(/confirm password/i, 'correcthorsebattery');
    submit(/create organization/i);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.password).toBe('correcthorsebattery');
    expect(body.password).not.toBe('admin');
    expect(Object.keys(body).sort()).toEqual([
      'organizationEmail',
      'organizationMobile',
      'organizationName',
      'password',
      'password_confirmation',
    ]);
  });

  it('toggles visibility for both password fields at once', () => {
    render(<Signup onCreated={() => {}} onSwitchToLogin={() => {}} />);

    const pw = screen.getByLabelText(/^password$/i) as HTMLInputElement;
    const confirm = screen.getByLabelText(/confirm password/i) as HTMLInputElement;
    expect(pw.type).toBe('password');
    expect(confirm.type).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(pw.type).toBe('text');
    expect(confirm.type).toBe('text');

    fireEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(pw.type).toBe('password');
  });

  it('attaches a server validation error to its own field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        message: 'The organization email has already been taken.',
        errors: { organizationEmail: ['That email address is already registered.'] },
      }),
    } as Response);

    render(<Signup onCreated={() => {}} onSwitchToLogin={() => {}} />);
    submit(/create organization/i);

    const message = await screen.findByText('That email address is already registered.');
    const input = screen.getByLabelText(/organization email/i);

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(message.id);
    expect(message.getAttribute('role')).toBe('alert');
  });

  it('reports a duplicate organization name on the name field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        errors: { organizationName: ['An organization with this name already exists.'] },
      }),
    } as Response);

    render(<Signup onCreated={() => {}} onSwitchToLogin={() => {}} />);
    submit(/create organization/i);

    await screen.findByText('An organization with this name already exists.');
    expect(screen.getByLabelText(/organization name/i).getAttribute('aria-invalid')).toBe('true');
  });

  it('clears a field error as soon as that field is edited', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ errors: { organizationEmail: ['That email address is already registered.'] } }),
    } as Response);

    render(<Signup onCreated={() => {}} onSwitchToLogin={() => {}} />);
    submit(/create organization/i);
    await screen.findByText('That email address is already registered.');

    fill(/organization email/i, 'ops@southwind.example');

    expect(screen.queryByText('That email address is already registered.')).toBeNull();
    expect(screen.getByLabelText(/organization email/i).getAttribute('aria-invalid')).toBeNull();
  });

  it('never shows a raw database error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: 'signup_failed',
        message: 'We could not create your organization. Please try again.',
      }),
    } as Response);

    render(<Signup onCreated={() => {}} onSwitchToLogin={() => {}} />);
    submit(/create organization/i);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('We could not create your organization.');
    expect(alert.textContent).not.toMatch(/SQLSTATE|tbluser|org_details/);
  });

  it('ends at a success state and hands the email to sign in', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => SIGNUP_OK,
    } as Response);

    const onCreated = vi.fn();
    render(<Signup onCreated={onCreated} onSwitchToLogin={() => {}} />);

    fill(/organization email/i, 'ops@northwind.example');
    submit(/create organization/i);

    await screen.findByText('Organization created successfully');
    expect(screen.getByText('Northwind Logistics')).toBeTruthy();

    // No database ids on show — the tenant id is plumbing, not news.
    expect(document.body.textContent).not.toMatch(/tenant id/i);

    // Signup does not enter the workspace; it does not hold a session either.
    expect(localStorage.getItem('accessToken')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /continue to sign in/i }));
    expect(onCreated).toHaveBeenCalledWith('ops@northwind.example');
  });

  it('offers a route back to login', () => {
    const onSwitchToLogin = vi.fn();
    render(<Signup onCreated={() => {}} onSwitchToLogin={onSwitchToLogin} />);

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(onSwitchToLogin).toHaveBeenCalled();
  });
});

describe('Login', () => {
  it('shows only email, password, show/hide and sign in', () => {
    render(<Login onLogin={() => {}} onSwitchToSignup={() => {}} />);

    const inputs = Array.from(document.querySelectorAll('input'));
    expect(inputs.map((i) => i.id)).toEqual(['email', 'password']);

    expect(screen.getByRole('button', { name: /show password/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeTruthy();
  });

  it('offers no forgot-password link, because there is no reset flow', () => {
    render(<Login onLogin={() => {}} onSwitchToSignup={() => {}} />);

    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/forgot/i);
    expect(body).not.toMatch(/OTP/i);
    expect(body).not.toMatch(/captcha/i);
  });

  it('prefills the email handed over by signup', () => {
    render(
      <Login onLogin={() => {}} onSwitchToSignup={() => {}} initialEmail="ops@northwind.example" />,
    );

    expect((screen.getByLabelText(/^email$/i) as HTMLInputElement).value).toBe(
      'ops@northwind.example',
    );
  });

  it('stores tokens and reports the session on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => SIGNUP_OK,
    } as Response);

    const onLogin = vi.fn();
    render(<Login onLogin={onLogin} onSwitchToSignup={() => {}} />);

    fill(/^email$/i, 'ops@northwind.example');
    fill(/^password$/i, 'harbour road');
    submit(/^sign in$/i);

    await waitFor(() => expect(onLogin).toHaveBeenCalled());

    expect(localStorage.getItem('accessToken')).toBe('access-token');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-token');
    expect(onLogin.mock.calls[0][0]).toMatchObject({
      organizationId: '12',
      organizationName: 'Northwind Logistics',
      role: 'tenant_admin',
      name: 'Administrator',
    });
  });

  it('shows the server message on a rejected credential and stores nothing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid_credentials', message: 'Incorrect email or password.' }),
    } as Response);

    render(<Login onLogin={() => {}} onSwitchToSignup={() => {}} />);
    submit(/^sign in$/i);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Incorrect email or password.');
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('routes to signup', () => {
    const onSwitchToSignup = vi.fn();
    render(<Login onLogin={() => {}} onSwitchToSignup={onSwitchToSignup} />);

    fireEvent.click(screen.getByRole('button', { name: /create your organization/i }));
    expect(onSwitchToSignup).toHaveBeenCalled();
  });
});

describe('Signup and Login are one product', () => {
  it('share the same control classes', () => {
    const { unmount } = render(<Signup onCreated={() => {}} onSwitchToLogin={() => {}} />);
    const signupClasses = new Set(
      Array.from(document.querySelectorAll('[class]')).flatMap((el) =>
        Array.from(el.classList).filter((c) => c === 'eb-auth' || c.startsWith('eb-auth-')),
      ),
    );
    unmount();

    render(<Login onLogin={() => {}} onSwitchToSignup={() => {}} />);
    const loginClasses = new Set(
      Array.from(document.querySelectorAll('[class]')).flatMap((el) =>
        Array.from(el.classList).filter((c) => c === 'eb-auth' || c.startsWith('eb-auth-')),
      ),
    );

    // The shared control vocabulary, present on both by construction.
    for (const shared of [
      'eb-auth',
      'eb-auth-shell',
      'eb-auth-panel',
      'eb-auth-rail',
      'eb-auth-field',
      'eb-auth-pw',
      'eb-auth-pw-toggle',
      'eb-auth-submit',
      'eb-auth-link',
      'eb-auth-flow',
    ]) {
      expect(signupClasses.has(shared)).toBe(true);
      expect(loginClasses.has(shared)).toBe(true);
    }

    // But not the same composition: login reverses the split.
    expect(loginClasses.has('eb-auth-reversed')).toBe(true);
    expect(signupClasses.has('eb-auth-reversed')).toBe(false);
  });
});
