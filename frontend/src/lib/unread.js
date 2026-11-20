// The unread-enquiries number shown in the nav. A tiny shared "something
// changed" signal lets the inbox tell the nav to ask again after a message is
// marked read, without the two knowing about each other.
import { useEffect, useState } from 'react';
import { unreadCount } from '../api/owner.js';

const listeners = new Set();
export const unreadChanged = () => listeners.forEach((listener) => listener());

// `where` is the current page address: going to another page asks again, so a
// new enquiry shows up without a reload. A failed ask keeps the last number.
export function useUnread(enabled, where) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    const refresh = () => unreadCount().then((n) => { if (!stopped) setCount(n); }, () => {});
    refresh();
    listeners.add(refresh);
    return () => { stopped = true; listeners.delete(refresh); };
  }, [enabled, where]);
  return enabled ? count : 0;
}
