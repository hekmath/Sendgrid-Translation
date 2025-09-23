'use client';

import { useUser, useClerk } from '@clerk/nextjs';
import { useTheme } from 'next-themes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { LogOut, Palette, Moon, Sun } from 'lucide-react';

interface UserMenuProps {
  placement?: 'header' | 'sidebar';
}

export function UserMenu({ placement = 'header' }: UserMenuProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { resolvedTheme, setTheme } = useTheme();

  if (!user) {
    return null;
  }

  const userInitials =
    user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user.emailAddresses[0]?.emailAddress[0].toUpperCase() || 'U';

  const isDark = resolvedTheme === 'dark';

  const handleLogout = async () => {
    try {
      await signOut({ redirectUrl: '/sign-in' });
    } catch (error) {
      // Fallback to manual navigation if signOut fails
      window.location.href = '/sign-in';
    }
  };

  const trigger = (
    <Button
      variant="ghost"
      className={
        placement === 'sidebar'
          ? 'w-full justify-start gap-3 rounded-md px-2 py-2 text-left'
          : 'relative h-10 w-10 rounded-full'
      }
    >
      <Avatar className={placement === 'sidebar' ? 'h-9 w-9' : 'h-10 w-10'}>
        <AvatarImage src={user.imageUrl} alt={user.fullName || 'User'} />
        <AvatarFallback>{userInitials}</AvatarFallback>
      </Avatar>
      {placement === 'sidebar' && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {user.fullName || 'User'}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {user.emailAddresses[0]?.emailAddress}
          </p>
        </div>
      )}
    </Button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56"
        align={placement === 'sidebar' ? 'start' : 'end'}
        sideOffset={placement === 'sidebar' ? 8 : 4}
        forceMount
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.fullName || 'User'}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.emailAddresses[0]?.emailAddress}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
          <Palette className="mr-2 h-4 w-4" />
          <span>Theme</span>
          <div className="ml-auto">
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-red-600 focus:text-red-600"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
