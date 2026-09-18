import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { AuthProvider } from "@/lib/AuthContext";
import Link from "next/link";

export const metadata = {
  title: "Wheely Useful Utils!",
  description: "A toolkit of randomised decision-making utilities — spin wheels, pick from lists, generate teams, and more.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <AuthProvider>
          <Navigation />
          <main style={{ flex: 1 }}>{children}</main>
          <footer style={{ padding: "2rem 1rem", textAlign: "center", borderTop: "1px solid var(--glass-border)", marginTop: "auto", fontSize: "0.85rem", opacity: 0.7 }}>
            &copy; {new Date().getFullYear()} Justin Goodland &bull; <Link href="/privacy" style={{ color: "var(--accent-blue)", textDecoration: "none" }}>Privacy Policy</Link>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
