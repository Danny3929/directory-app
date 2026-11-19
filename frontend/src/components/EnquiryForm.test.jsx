// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import EnquiryForm from './EnquiryForm.jsx';

afterEach(cleanup);

const show = () => render(<EnquiryForm gymName="Baobab Barbell" slug="flexline-fitness" />);
const box = (label) => screen.getByLabelText(label);
const type = (label, value) => fireEvent.change(box(label), { target: { value } });
const send = () => fireEvent.click(screen.getByRole('button', { name: /send enquiry/i }));

const fillGood = () => {
  type(/your name/i, 'Ana Wanjiru');
  type(/email/i, 'ana@example.com');
  type(/message/i, 'Do you have evening classes?');
};

describe('EnquiryForm', () => {
  it('has a heading and a label for every box', () => {
    show();
    expect(screen.getByRole('heading', { name: /ask baobab barbell/i })).toBeTruthy();
    expect(box(/your name/i).getAttribute('autocomplete')).toBe('name');
    expect(box(/email/i).getAttribute('type')).toBe('email');
    expect(box(/message/i).tagName).toBe('TEXTAREA');
  });

  it('no longer calls itself a demo', () => {
    show();
    expect(screen.queryByText(/demo/i)).toBeNull();
  });

  it('shows no errors until Send is pressed', () => {
    show();
    type(/your name/i, '');
    expect(screen.queryByText('Enter your name.')).toBeNull();
  });

  it('on an empty Send: shows every error, links it to its box, and focuses the first box', () => {
    show();
    send();
    const name = box(/your name/i);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    const errorId = name.getAttribute('aria-describedby').split(' ').find((id) => id.endsWith('-error'));
    expect(document.getElementById(errorId).textContent).toBe('Enter your name.');
    expect(screen.getByText('Enter your email address.')).toBeTruthy();
    expect(screen.getByText('Enter a message.')).toBeTruthy();
    expect(document.activeElement).toBe(name);
  });

  it('focuses the first wrong box, not always the name', () => {
    show();
    fillGood();
    type(/email/i, 'ana@');
    send();
    expect(document.activeElement).toBe(box(/email/i));
    expect(box(/your name/i).getAttribute('aria-invalid')).toBe('false');
  });

  it('after a failed Send, an error goes away as soon as the box is fixed', () => {
    show();
    send();
    type(/your name/i, 'Ana');
    expect(screen.queryByText('Enter your name.')).toBeNull();
    expect(screen.getByText('Enter your email address.')).toBeTruthy();
  });

  it('a good Send posts to the API, then shows a thank-you that names the visitor and is focused', async () => {
    show();
    fillGood();
    send();
    const thanks = await screen.findByRole('status');
    const [url, init] = fetch.mock.calls.at(-1);
    expect(url).toMatch(/\/listings\/flexline-fitness\/enquiries\/$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      name: 'Ana Wanjiru', email: 'ana@example.com', message: 'Do you have evening classes?',
    });
    expect(thanks.textContent).toMatch(/thanks, ana wanjiru/i);
    expect(thanks.textContent).toMatch(/was sent/i);
    expect(screen.queryByLabelText(/message/i)).toBeNull();
    expect(document.activeElement).toBe(thanks);
  });

  it('Send another gives an empty form with focus in the name box', async () => {
    show();
    fillGood();
    send();
    await screen.findByRole('status');
    fireEvent.click(screen.getByRole('button', { name: /send another/i }));
    expect(box(/your name/i).value).toBe('');
    expect(box(/message/i).value).toBe('');
    expect(document.activeElement).toBe(box(/your name/i));
  });

  it('shows the visitor name as text, never as HTML', async () => {
    show();
    fillGood();
    type(/your name/i, '<img src=x onerror=alert(1)>');
    send();
    const thanks = await screen.findByRole('status');
    expect(document.querySelector('.enquiry img')).toBeNull();
    expect(thanks.textContent).toMatch(/<img src=x/);
  });

  it('does not post while the browser checks fail', () => {
    show();
    send();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('puts the server complaint next to the box it names, and focuses it', async () => {
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'invalid', message: 'Please check the highlighted fields.', fields: { email: ['Enter a valid email address.'] } },
    }), { status: 400 }));
    show();
    fillGood();
    send();
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
    expect(box(/email/i).getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(box(/email/i));
    // The visitor's text is kept, so nothing has to be typed again.
    expect(box(/message/i).value).toBe('Do you have evening classes?');
  });

  it('shows the too-many-messages answer as an alert and keeps the text', async () => {
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'throttled', message: 'Too many messages. Try again in an hour.', fields: {} },
    }), { status: 429 }));
    show();
    fillGood();
    send();
    expect((await screen.findByRole('alert')).textContent).toMatch(/too many messages/i);
    expect(box(/message/i).value).toBe('Do you have evening classes?');
  });

  it('with the backend stopped: a plain message, the text is kept, and Send works again', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    show();
    fillGood();
    send();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not send your message. Please try again.');
    expect(alert.textContent).not.toMatch(/fetch|TypeError/);
    expect(box(/message/i).value).toBe('Do you have evening classes?');
    await waitFor(() => expect(screen.getByRole('button', { name: /send enquiry/i }).disabled).toBe(false));
  });

  it('ignores a second click while the first is still sending', async () => {
    let finish;
    fetch.mockImplementationOnce(() => new Promise((r) => { finish = () => r(new Response('{}', { status: 201 })); }));
    show();
    fillGood();
    send();
    // The button is disabled now; also try submitting the form directly (Enter key).
    fireEvent.submit(document.querySelector('form'));
    expect(fetch).toHaveBeenCalledTimes(1);
    finish();
    await screen.findByRole('status');
  });
});
