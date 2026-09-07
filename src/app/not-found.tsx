import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-white">Story not found</h1>
      <Link href="/" className="mt-4 inline-block text-newsroom-gold hover:underline">
        Back to newsroom
      </Link>
    </main>
  );
}
