// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import EnquiryForm from './EnquiryForm.jsx';

afterEach(cleanup);

const show = () => render(<EnquiryForm gymName="Baobab Barbell" />);
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

  it('says it is a demo before anyone types', () => {
    show();
    expect(screen.getByText(/nothing is sent yet/i)).toBeTruthy();
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

  it('a good Send replaces the form with a thank-you that names the visitor and is focused', () => {
    show();
    fillGood();
    send();
    const thanks = screen.getByRole('status');
    expect(thanks.textContent).toMatch(/thanks, ana wanjiru/i);
    expect(thanks.textContent).toMatch(/demo/i);
    expect(screen.queryByLabelText(/message/i)).toBeNull();
    expect(document.activeElement).toBe(thanks);
  });

  it('Send another gives an empty form with focus in the name box', () => {
    show();
    fillGood();
    send();
    fireEvent.click(screen.getByRole('button', { name: /send another/i }));
    expect(box(/your name/i).value).toBe('');
    expect(box(/message/i).value).toBe('');
    expect(document.activeElement).toBe(box(/your name/i));
  });

  it('shows the visitor name as text, never as HTML', () => {
    show();
    fillGood();
    type(/your name/i, '<img src=x onerror=alert(1)>');
    send();
    expect(document.querySelector('.enquiry img')).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/<img src=x/);
  });
});
