import type { Metadata } from "next"
import { Inter, Poppins } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import Navbar from "@/components/Navbar"
import { GridBoundary } from "@/components/layout/grid-boundary"
import { PageGrid } from "@/components/layout/page-grid"
import { Toaster } from "@repo/ui/components/ui/toast"
import { ThemeProvider } from "@/providers/theme-provider"
import { Footer } from "@/components/Footer"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Fernleaf Kitchen",
  description: "Fernleaf Kitchen",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans", inter.variable, poppins.variable)}
    >
      <body>
        <ThemeProvider attribute="class" enableSystem disableTransitionOnChange>
          <PageGrid>
            <Navbar />
            <GridBoundary />
            {children}
            <GridBoundary />
            <Footer />
          </PageGrid>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
