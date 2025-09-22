'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Sign In
          </h1>
          <p className="text-muted-foreground">
            Access your SendGrid template manager
          </p>
        </div>
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