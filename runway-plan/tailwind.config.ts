import type { Config } from "tailwindcss";
console.log("TAILWIND CONFIG LOADED: c:/xampp/htdocs/nexsq/runway-plan/tailwind.config.ts");

export default {
  darkMode: ["class"],
  content: ["../../index.html", "./pages/**/*.{js,ts,jsx,tsx,html}", "./components/**/*.{js,ts,jsx,tsx,html}", "./app/**/*.{js,ts,jsx,tsx,html}", "./src/**/*.{js,ts,jsx,tsx,html}"],
  import type { Config } from "tailwindcss";

  // Neutral minimal config to avoid being picked up during dev
  const minimal: Config = {
    content: ["./index.html"],
    theme: { extend: {} },
    plugins: [],
  };

  export default minimal;
} satisfies Config;
