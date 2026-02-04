import './globals.css'

export const metadata = {
  title: 'Lead Intake System',
  description: 'Lead Management Dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
