import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "The Union — Where the Internet Gathers",
  description: "The Union is a single-community platform where people share ideas, debate, post memes, and build together. Join the conversation.",
  keywords: ["community", "forum", "social", "posts", "discussion", "the union"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('the-union-theme');var ok=['default','reddit','spongebob','minecraft','cod'];if(t&&ok.indexOf(t)!==-1)document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
      </head>
      <body className="antialiased min-h-screen bg-bg-primary text-text-primary">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
