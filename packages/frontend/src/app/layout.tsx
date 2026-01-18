import "../styles/app.scss";
import type { Viewport, Metadata } from "next";
import type { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

const Layout = async ({ children }: LayoutProps) => {

  return (
    <html lang="en">
      <head>
        <meta
          name="format-detection"
          content="telephone=no,address=no,email=no,date=no,url=no"
        />
      </head>
      <body>{children}</body>
    </html>
  );
};

export const metadata: Metadata = {
  title: {
    default: "London Underground Map",
    template: `%s | London Underground Map`,
  },
  description: "Interactive map of London with Underground layer",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
} as Viewport;

export default Layout;
