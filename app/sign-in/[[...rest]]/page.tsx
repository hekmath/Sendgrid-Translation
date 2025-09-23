'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <SignIn
          routing="path"
          path="/sign-in"
          redirectUrl="/"
          signUpUrl={undefined}
        />
      </div>
    </div>
  );
}
