'use client';

import { useEffect } from 'react';
import { MARKUP } from './markup';
import { initMailer } from '../lib/mailer-client';

// The mailer is a vanilla-JS app: React renders its markup once, then the script takes over.
export default function MailerApp() {
  useEffect(() => initMailer(), []);
  return <div dangerouslySetInnerHTML={{ __html: MARKUP }} />;
}
