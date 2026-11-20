export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 p-4">
      <p className="text-center text-lg font-semibold">Closery</p>
      {children}
    </main>
  );
}
