'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SignUpPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to sign-in since sign-up is disabled
    router.push('/sign-in');
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Sign-up Disabled
        </h1>
        <p className="text-muted-foreground mb-4">
          This is an internal tool. Redirecting to sign-in...
        </p>
      </div>
    </div>
  );
}