import React from "react";

interface WelcomeProps {
  name?: string;
}

export const Welcome: React.FC<WelcomeProps> = ({ name }) => (
  <div className="p-6 bg-white dark:bg-zinc-900 rounded-lg shadow text-center">
    <h1 className="text-2xl font-bold mb-2">Welcome{name ? `, ${name}` : ""}!</h1>
    <p className="text-gray-600 dark:text-gray-300">This is your new Next.js + Tailwind CSS project. Start building something awesome!</p>
  </div>
);
