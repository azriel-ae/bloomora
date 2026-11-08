'use client';

import { useEffect, useState } from 'react';
import { getAdminGreeting } from '@/lib/admin-greeting';

export function AdminTimeGreeting() {
  const [greeting, setGreeting] = useState('Selamat datang, Bloomora.');

  useEffect(() => {
    const updateGreeting = () => setGreeting(getAdminGreeting(new Date().getHours()));
    updateGreeting();
    const timer = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return <h1 className="mt-2 font-display text-4xl sm:text-5xl">{greeting}</h1>;
}
