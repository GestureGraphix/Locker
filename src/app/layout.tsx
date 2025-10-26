import { Navigation } from "@/components/navigation"
import { RoleProvider } from "@/components/role-context"
import "./globals.css"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <RoleProvider>
          <div className="min-h-screen bg-gray-50">
            <Navigation />
            <main className="lg:pl-80">
              <div className="py-6">
                <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
                  {children}
                </div>
              </div>
            </main>
          </div>
        </RoleProvider>
      </body>
    </html>
  )
}