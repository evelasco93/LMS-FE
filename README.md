# Lead Intake UI - Prototype MVP

A quick and simple Next.js dashboard for displaying lead intake data from DynamoDB. This is a **prototype MVP** built for rapid development and testing purposes with limited functionality and straightforward code implementation.

## ⚠️ Prototype Notice

This is a proof-of-concept implementation focused on core functionality:
- No advanced filtering, sorting, or search capabilities
- Minimal error handling and validation
- Basic styling and layout
- No authentication or authorization
- Simple client-side caching only
- Direct API integration without middleware

## Features

- 📊 **Lead Data Display**: Table view with 33+ columns including contact info, validation results, and marketing data
- 🔄 **Auto-Refresh**: Automatic data refresh with 5-minute client-side cache
- 🎨 **Visual Indicators**: Color-coded boolean values (green for true, red for false)
- 🕐 **Dual Time Display**: Shows both UTC and local timezone conversions
- 🔍 **IPQS Modal**: Detailed view of IP Quality Score validation data with nested sub-tables
- 📜 **TrustedForm Modal**: Certificate validation results and outcomes
- 🎯 **Icon System**: Lucide React icons for all column headers
- 📱 **Responsive Layout**: Basic responsive table design
- 💾 **Client-Side Caching**: LocalStorage-based caching (5-minute TTL)

## Folder Structure

```
prototype_lead_intake_ui/
├── app/
│   ├── globals.css          # Global styles and Tailwind directives
│   ├── layout.js            # Root layout component
│   └── page.js              # Main dashboard page (943 lines)
├── .gitignore
├── next.config.js           # Next.js configuration
├── package.json             # Dependencies and scripts
├── postcss.config.js        # PostCSS configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── README.md
```

## Key Components (app/page.js)

### State Management
- `leads[]` - Array of lead data
- `loading` - Loading state for API calls
- `modalOpen` / `selectedIpqsData` - IPQS modal state
- `tfModalOpen` / `selectedTfData` - TrustedForm modal state
- `lastUpdated` - Timestamp of last data fetch

### Core Functions
- `fetchLeads()` - API call with localStorage caching
- `loadLeads()` - Cache-first loading strategy
- `renderValue()` - Smart rendering for different data types (booleans, objects, arrays, modals)
- `renderDataTable()` - Nested table rendering for complex IPQS data
- `renderResultsSummary()` - Validation results with color-coded badges
- `convertUTCToLocal()` - Timezone conversion using browser's local timezone

### Column Order (33 fields)
ID, Date, Time (UTC), Time (Local), Marketing Source, First Name, Last Name, Phone, Email, State, Message, Rideshare Abuse, Rideshare Company, Abuse State, Gender, Assault Type, Has Ride Receipt, Has Attorney, Test, Campaign ID, Campaign Key, Sub ID, Pub ID, IP Address, Page URL, Referrer URL, Trusted Form Cert ID, Passed TF Check, Passed Phone Check, Passed Email Check, Passed IP Check, TrustedForm Response, IPQS Response, Sellable, Sold, Cherry Picked

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## API Integration

**Endpoint**: `https://l0gjg111fk.execute-api.us-east-1.amazonaws.com/dev/smashorbit/prototype/lead`

**Expected Response Format**:
```json
{
  "success": true,
  "message": "Leads retrieved successfully",
  "count": 1,
  "data": [
    {
      "id": "...",
      "timestamp": "2026-02-04T00:10:34.440Z",
      "date": "2026-02-04",
      "time": "00:10:34",
      "first_name": "...",
      "ipqs_response": { ... },
      "trustedform_response": { ... },
      ...
    }
  ]
}
```

**DynamoDB Mapping**: The API returns data directly from DynamoDB with DynamoDB type descriptors (S, BOOL, M, L, N, NULL) which are parsed on the backend before sending to the frontend.

## Technology Stack

- **Next.js 14.1.0** - React framework with App Router
- **React 18.2.0** - UI library with hooks
- **Tailwind CSS 3.4.1** - Utility-first CSS framework
- **Lucide React 0.316.0** - Icon library
- **LocalStorage API** - Client-side caching

## Limitations & Future Enhancements

As a prototype MVP, the following features are intentionally not implemented:

- ❌ No sorting or filtering capabilities
- ❌ No search functionality
- ❌ No pagination (displays all records)
- ❌ No user authentication
- ❌ No data editing or management
- ❌ No export functionality (CSV, Excel, etc.)
- ❌ No advanced error handling or retry logic
- ❌ No server-side rendering or optimization
- ❌ No unit tests or integration tests
- ❌ No field validation or data sanitization

## Notes

- Time conversion uses the browser's local timezone (not IP-based geolocation)
- Cache duration is hardcoded to 5 minutes
- All data rendering is client-side only
- Modal components are inline (not separate components)
- Code prioritizes simplicity over performance and scalability
