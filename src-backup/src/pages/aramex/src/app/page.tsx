import { Welcome } from "../components/Welcome";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <Welcome name="Developer" />
    </main>
  );
}
