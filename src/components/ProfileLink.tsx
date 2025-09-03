import React from "react";
import { cn } from "@/lib/utils";

interface ProfileLinkProps extends React.HTMLAttributes<HTMLAnchorElement> {
  userId: string;
  children: React.ReactNode;
  className?: string;
}

export const ProfileLink = React.forwardRef<HTMLAnchorElement, ProfileLinkProps>(
  ({ userId, children, className = "", ...props }, ref) => {
    return (
      <a
        ref={ref}
        href={`/profile/${userId}`}
        className={cn(
          "hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer focus:outline-none transition px-0 py-0 rounded text-inherit no-underline",
          className
        )}
        style={{
          textDecoration: "none",
        }}
        {...props}
      >
        {children}
      </a>
    );
  }
);
ProfileLink.displayName = "ProfileLink";